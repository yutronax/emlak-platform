import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/iyzico";
import { createServiceRoleClient } from "@/lib/supabase/server";

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

const STATUS_BY_EVENT_TYPE: Record<string, "active" | "failed"> = {
  PAYMENT_SUCCESS: "active",
  PAYMENT_FAILED: "failed",
};

interface PaymentEvent {
  event_id: string;
  event_type: string;
  subscription_id: string;
}

type SupabaseServiceClient = ReturnType<typeof createServiceRoleClient>;

type ParseFailure = { error: "INVALID_BODY" | "MISSING_FIELD" };

// JSON gövdeyi ayrıştırır ve zorunlu alanları doğrular. Hata türünü ayırt eder:
// JSON bozuksa INVALID_BODY, zorunlu alan eksikse MISSING_FIELD döner. Çağıran
// taraf her biri için orijinal INVALID_INPUT mesajını üretir.
function parsePaymentEvent(rawBody: string): PaymentEvent | ParseFailure {
  let event: PaymentEvent;
  try {
    event = JSON.parse(rawBody) as PaymentEvent;
  } catch {
    return { error: "INVALID_BODY" };
  }
  if (!event.event_id || !event.event_type || !event.subscription_id) {
    return { error: "MISSING_FIELD" };
  }
  return event;
}

// Idempotency: provider_event_id unique. Aynı olay ikinci kez gelirse state değişmez.
async function insertPaymentEvent(supabase: SupabaseServiceClient, event: PaymentEvent) {
  const { data: insertedEvent, error: insertError } = (await supabase
    .from("payment_events")
    .insert({
      provider_event_id: event.event_id,
      event_type: event.event_type,
      subscription_id: event.subscription_id,
      raw_payload: event,
    })
    .select("id")) as { data: { id: string }[] | null; error: { code: string } | null };

  if (insertError) {
    if (insertError.code === "23505") {
      return { duplicate: true as const, paymentEventId: undefined };
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
  if (insertResult.insertFailed) {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }

  const status = STATUS_BY_EVENT_TYPE[event.event_type];
  if (!status) {
    return NextResponse.json({ received: true });
  }

  return reconcileSubscriptionStatus(supabase, event, status, insertResult.paymentEventId);
}
