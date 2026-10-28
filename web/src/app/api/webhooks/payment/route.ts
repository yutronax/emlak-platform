import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/iyzico";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { addBusinessDays, DELIVERY_BUSINESS_DAYS } from "@/lib/video-orders/limits";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

const STATUS_BY_EVENT_TYPE: Record<string, "active" | "failed"> = {
  PAYMENT_SUCCESS: "active",
  PAYMENT_FAILED: "failed",
};

type VideoOrderTarget = "in_progress" | "payment_failed";

const VIDEO_TARGET_BY_EVENT_TYPE: Partial<Record<string, VideoOrderTarget>> = {
  PAYMENT_SUCCESS: "in_progress",
  PAYMENT_FAILED: "payment_failed",
};

interface PaymentEvent {
  event_id: string;
  event_type: string;
  subscription_id: string;
}

interface VideoPaymentEvent {
  event_id: string;
  event_type: string;
  video_order_id: string;
}

type AnyPaymentEvent = PaymentEvent | VideoPaymentEvent;

type SupabaseServiceClient = ReturnType<typeof createServiceRoleClient>;

type ParseFailure = { error: "INVALID_BODY" | "MISSING_FIELD" };

// JSON gövdeyi ayrıştırır ve zorunlu alanları doğrular. Hata türünü ayırt eder:
// JSON bozuksa INVALID_BODY, zorunlu alan eksikse MISSING_FIELD döner. Çağıran
// taraf her biri için orijinal INVALID_INPUT mesajını üretir. subscription_id ve
// video_order_id alanlarından tam olarak biri dolu olmalıdır.
function parsePaymentEvent(rawBody: string): AnyPaymentEvent | ParseFailure {
  let event: Partial<PaymentEvent & VideoPaymentEvent>;
  try {
    event = JSON.parse(rawBody) as Partial<PaymentEvent & VideoPaymentEvent>;
  } catch {
    return { error: "INVALID_BODY" };
  }
  if (!event?.event_id || !event.event_type) {
    return { error: "MISSING_FIELD" };
  }
  const hasSubscription = Boolean(event.subscription_id);
  const hasVideoOrder = Boolean(event.video_order_id);
  if (hasSubscription === hasVideoOrder) {
    return { error: "MISSING_FIELD" };
  }
  if (hasVideoOrder && (typeof event.video_order_id !== "string" || !UUID_PATTERN.test(event.video_order_id))) {
    return { error: "MISSING_FIELD" };
  }
  if (hasVideoOrder) {
    return {
      event_id: event.event_id,
      event_type: event.event_type,
      video_order_id: event.video_order_id as string,
    };
  }
  return {
    event_id: event.event_id,
    event_type: event.event_type,
    subscription_id: event.subscription_id as string,
  };
}

// Idempotency: provider_event_id unique. Aynı olay ikinci kez gelirse state değişmez.
async function insertPaymentEvent(supabase: SupabaseServiceClient, event: AnyPaymentEvent) {
  const { data: insertedEvent, error: insertError } = (await supabase
    .from("payment_events")
    .insert({
      provider_event_id: event.event_id,
      event_type: event.event_type,
      ...("video_order_id" in event
        ? { video_order_id: event.video_order_id }
        : { subscription_id: event.subscription_id }),
      raw_payload: event,
    })
    .select("id")) as { data: { id: string }[] | null; error: { code: string } | null };

  if (insertError) {
    if (insertError.code === "23505") {
      return { duplicate: true as const, paymentEventId: undefined };
    }
    // 23503: olay var olmayan bir abonelik/siparişe ait; 22P02: kimlik uuid değil.
    // 500 dönülürse sağlayıcı aynı kalıcı hatayı sonsuza dek tekrar dener.
    if (insertError.code === "23503" || insertError.code === "22P02") {
      console.warn("payment webhook: olayın sahibi bulunamadı", event.event_id);
      return { duplicate: false as const, unknownOwner: true as const, paymentEventId: undefined };
    }
    console.error("payment_events insert başarısız", insertError);
    return { duplicate: false as const, insertFailed: true as const, paymentEventId: undefined };
  }

  const insertedRows = Array.isArray(insertedEvent) ? insertedEvent : insertedEvent ? [insertedEvent] : [];
  return { duplicate: false as const, insertFailed: false as const, paymentEventId: insertedRows[0]?.id };
}

// Koşullu update (status=pending) 0 satır etkilediğinde mevcut durumu okuyup
// gerekirse needs_review'a çeker; ardından hiçbir yazma başarılı olmazsa
// payment_events'i processing_error ile işaretler. Bu fonksiyon, PM
// bulgusundaki 3 seviyeli iç içe fallback zincirini POST'tan ayırır.
async function reconcileSubscriptionStatus(
  supabase: SupabaseServiceClient,
  event: PaymentEvent,
  status: "active" | "failed",
  paymentEventId: string | undefined,
): Promise<NextResponse> {
  try {
    const patch =
      status === "active"
        ? { status, current_period_end: new Date(Date.now() + PERIOD_MS).toISOString() }
        : { status };
    const { data, error } = await supabase
      .from("subscriptions")
      .update(patch)
      .eq("id", event.subscription_id)
      .eq("status", "pending")
      .select("id");
    if (error) throw error;

    if (!data || data.length === 0) {
      await handleNoRowsUpdated(supabase, event, status);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    // Sağlayıcıya ve istemciye ham hata gönderilmez; yalnızca sunucu logu.
    console.error("abonelik güncellenemedi", event.subscription_id, error);
    return markNeedsReviewOrProcessingError(supabase, event, paymentEventId);
  }
}

// Koşullu update 0 satır etkilediğinde: abonelik yoksa, zaten hedef
// durumdaysa veya beklenmeyen bir durumdaysa (bu durumda needs_review'a çekilir).
async function handleNoRowsUpdated(
  supabase: SupabaseServiceClient,
  event: PaymentEvent,
  status: "active" | "failed",
): Promise<void> {
  const { data: current, error: readError } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("id", event.subscription_id)
    .maybeSingle();
  if (readError) throw readError;

  if (!current) {
    console.warn("payment webhook: subscription_id bulunamadı", event.subscription_id);
  } else if (current.status === status) {
    console.warn("payment webhook: abonelik zaten hedef durumda, no-op", event.subscription_id);
  } else {
    console.warn("payment webhook: beklenmeyen abonelik durumu, needs_review'a çekiliyor", event.subscription_id, current.status);
    await supabase.from("subscriptions").update({ status: "needs_review" }).eq("id", event.subscription_id);
  }
}

// İlk update hata verdiğinde abonelik needs_review'a çekilmeye çalışılır; bu da
// başarısız olursa payment_events processing_error ile işaretlenir.
async function markNeedsReviewOrProcessingError(
  supabase: SupabaseServiceClient,
  event: PaymentEvent,
  paymentEventId: string | undefined,
): Promise<NextResponse> {
  try {
    const { error: needsReviewError } = await supabase
      .from("subscriptions")
      .update({ status: "needs_review" })
      .eq("id", event.subscription_id);
    if (needsReviewError) throw needsReviewError;
  } catch (needsReviewError) {
    console.error("abonelik needs_review'a da çekilemedi", event.subscription_id, needsReviewError);
    if (paymentEventId) {
      try {
        const { error: processingErrorUpdateError } = await supabase
          .from("payment_events")
          .update({ processing_error: true })
          .eq("id", paymentEventId);
        if (processingErrorUpdateError) throw processingErrorUpdateError;
      } catch (processingErrorUpdateError) {
        console.error("payment_events processing_error işaretlenemedi", paymentEventId, processingErrorUpdateError);
      }
    }
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
  return NextResponse.json({
    received: true,
    subscription_id: event.subscription_id,
    status: "needs_review",
  });
}

// Video siparişi: PAYMENT_SUCCESS → in_progress (paid_at, due_at); PAYMENT_FAILED →
// payment_failed. Koşullu update; 0 satırda mevcut duruma göre no-op veya log.
// Durum değişmez; needs_review yok. DB hatasında payment_events processing_error işaretlenir.
async function reconcileVideoOrderStatus(
  supabase: SupabaseServiceClient,
  event: VideoPaymentEvent,
  target: VideoOrderTarget,
  paymentEventId: string | undefined,
): Promise<NextResponse> {
  try {
    const { data, error } =
      target === "in_progress"
        ? await markVideoOrderPaid(supabase, event.video_order_id)
        : await markVideoOrderPaymentFailed(supabase, event.video_order_id);
    if (error) throw error;

    if (!data || data.length === 0) {
      await handleNoVideoOrderRowsUpdated(supabase, event, target, paymentEventId);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("video sipariş durumu güncellenemedi", event.video_order_id, error);
    if (paymentEventId) {
      const { error: processingErrorUpdateError } = await supabase
        .from("payment_events")
        .update({ processing_error: true })
        .eq("id", paymentEventId);
      if (processingErrorUpdateError) {
        console.error("payment_events processing_error işaretlenemedi", paymentEventId, processingErrorUpdateError);
      }
    }
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

function markVideoOrderPaid(supabase: SupabaseServiceClient, orderId: string) {
  const now = new Date();
  return supabase
    .from("video_orders")
    .update({
      status: "in_progress",
      paid_at: now.toISOString(),
      due_at: addBusinessDays(now, DELIVERY_BUSINESS_DAYS).toISOString(),
    })
    .eq("id", orderId)
    .in("status", ["awaiting_payment", "payment_failed"])
    .select("id");
}

function markVideoOrderPaymentFailed(supabase: SupabaseServiceClient, orderId: string) {
  return supabase
    .from("video_orders")
    .update({ status: "payment_failed" })
    .eq("id", orderId)
    .eq("status", "awaiting_payment")
    .select("id");
}

async function handleNoVideoOrderRowsUpdated(
  supabase: SupabaseServiceClient,
  event: VideoPaymentEvent,
  target: VideoOrderTarget,
  paymentEventId: string | undefined,
): Promise<void> {
  const { data: current, error: readError } = await supabase
    .from("video_orders")
    .select("status")
    .eq("id", event.video_order_id)
    .maybeSingle();
  if (readError) throw readError;

  if (!current) {
    console.warn("payment webhook: video_order_id bulunamadı", event.video_order_id);
    return;
  }
  // Ödenmiş/kapanmış siparişe farklı bir başarılı ödeme olayı: büyük olasılıkla ikinci tahsilat.
  // Durum değişmez; olay satırı işaretlenir ki iade için sorgulanabilsin.
  if (target === "in_progress") {
    console.error("payment webhook: olası çift tahsilat, iade gerekebilir", event.video_order_id, current.status);
    if (paymentEventId) {
      const { error } = await supabase.from("payment_events").update({ processing_error: true }).eq("id", paymentEventId);
      if (error) console.error("payment_events processing_error işaretlenemedi", paymentEventId, error);
    }
    return;
  }
  if (current.status !== target) {
    console.warn("payment webhook: video sipariş durumu geçişe uygun değil, state değişmedi", event.video_order_id, current.status);
  }
}

export async function POST(request: NextRequest) {
  // İmza DB'ye dokunulmadan ÖNCE doğrulanır (AC-S3).
  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, request.headers.get("x-iyzico-signature"))) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  const parsed = parsePaymentEvent(rawBody);
  if ("error" in parsed) {
    const message = parsed.error === "INVALID_BODY" ? "Geçersiz istek gövdesi" : "Eksik olay alanı";
    return NextResponse.json({ error: "INVALID_INPUT", message }, { status: 400 });
  }
  const event = parsed;

  // Webhook yazmaları RLS'i bypass eden service-role client ile yapılır.
  const supabase = createServiceRoleClient();

  const insertResult = await insertPaymentEvent(supabase, event);
  if (insertResult.duplicate) {
    return NextResponse.json({ received: true, duplicate: true, event_id: event.event_id });
  }
  if ("unknownOwner" in insertResult) {
    return NextResponse.json({ received: true });
  }
  if (insertResult.insertFailed) {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }

  if ("video_order_id" in event) {
    const target = VIDEO_TARGET_BY_EVENT_TYPE[event.event_type];
    if (!target) {
      return NextResponse.json({ received: true });
    }
    return reconcileVideoOrderStatus(supabase, event, target, insertResult.paymentEventId);
  }

  const status = STATUS_BY_EVENT_TYPE[event.event_type];
  if (!status) {
    return NextResponse.json({ received: true });
  }

  return reconcileSubscriptionStatus(supabase, event, status, insertResult.paymentEventId);
}
