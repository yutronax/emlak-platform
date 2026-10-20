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

export async function POST(request: NextRequest) {
  // İmza DB'ye dokunulmadan ÖNCE doğrulanır (AC-S3).
  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, request.headers.get("x-iyzico-signature"))) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let event: PaymentEvent;
  try {
    event = JSON.parse(rawBody) as PaymentEvent;
  } catch {
    return NextResponse.json({ error: "INVALID_INPUT", message: "Geçersiz istek gövdesi" }, { status: 400 });
  }
  if (!event.event_id || !event.event_type || !event.subscription_id) {
    return NextResponse.json({ error: "INVALID_INPUT", message: "Eksik olay alanı" }, { status: 400 });
  }

  // Webhook yazmaları RLS'i bypass eden service-role client ile yapılır.
  const supabase = createServiceRoleClient();

  // Idempotency: provider_event_id unique. Aynı olay ikinci kez gelirse state değişmez.
  const { error: insertError } = await supabase.from("payment_events").insert({
    provider_event_id: event.event_id,
    event_type: event.event_type,
    subscription_id: event.subscription_id,
    raw_payload: event,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true, event_id: event.event_id });
    }
    console.error("payment_events insert başarısız", insertError);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }

  const status = STATUS_BY_EVENT_TYPE[event.event_type];
  if (!status) {
    return NextResponse.json({ received: true });
  }

  try {
    const patch =
      status === "active"
        ? { status, current_period_end: new Date(Date.now() + PERIOD_MS).toISOString() }
        : { status };
    const { data, error } = await supabase
      .from("subscriptions")
      .update(patch)
      .eq("id", event.subscription_id)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      console.warn("payment webhook: subscription_id bulunamadı", event.subscription_id);
    }
  } catch (error) {
    // Sağlayıcıya ve istemciye ham hata gönderilmez; yalnızca sunucu logu.
    console.error("abonelik güncellenemedi", event.subscription_id, error);
    return NextResponse.json({
      received: true,
      subscription_id: event.subscription_id,
      status: "needs_review",
    });
  }

  return NextResponse.json({ received: true });
}
