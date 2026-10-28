import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/payments/iyzico";
import { createClient } from "@/lib/supabase/server";

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const recentRequests = new Map<string, number[]>();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAYABLE_STATUSES: readonly string[] = ["awaiting_payment", "payment_failed"];

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (recentRequests.get(userId) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );
  recent.push(now);
  recentRequests.set(userId, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

function isProviderTimeout(error: unknown): boolean {
  return (error as { name?: unknown } | null)?.name === "TimeoutError";
}

// Gövde bilerek okunmaz: tutar yalnızca video_orders.price_minor_unit'ten gelir.
// Hata durumlarında sipariş durumu değiştirilmez; yazma yapılmaz.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = auth.user.id;

  if (isRateLimited(userId)) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Çok fazla istek gönderildi, biraz bekleyin" },
      { status: 429 },
    );
  }

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Sipariş bulunamadı" }, { status: 404 });
  }

  // Kullanıcı client'ı + agent_id filtresi: başkasının siparişi de "bulunamadı" döner (AC-S1).
  const { data: order, error: orderError } = await supabase
    .from("video_orders")
    .select("id, status, price_minor_unit, currency")
    .eq("id", id)
    .eq("agent_id", userId)
    .maybeSingle();
  if (orderError) {
    console.error("video_orders sorgusu başarısız", orderError);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Sipariş bulunamadı" }, { status: 404 });
  }

  if (order.status === "quote_pending") {
    return NextResponse.json(
      { error: "QUOTE_PENDING", message: "Fiyat teklifi bekleniyor" },
      { status: 409 },
    );
  }
  if (!PAYABLE_STATUSES.includes(order.status)) {
    return NextResponse.json(
      { error: "INVALID_STATE", message: "Sipariş bu durumda ödenemez" },
      { status: 409 },
    );
  }

  const amountMinor = Number(order.price_minor_unit ?? 0);
  if (!(amountMinor > 0)) {
    return NextResponse.json(
      { error: "INVALID_STATE", message: "Sipariş bu durumda ödenemez" },
      { status: 409 },
    );
  }

  try {
    const session = await createCheckoutSession({
      amountMinor,
      currency: order.currency,
      basketId: order.id,
      conversationId: userId,
      paymentGroup: "PRODUCT",
    });
    return NextResponse.json(
      {
        order_id: order.id,
        checkout_url: session.checkout_url,
        expires_at: session.expires_at,
      },
      { status: 201 },
    );
  } catch (error) {
    if (isProviderTimeout(error)) {
      return NextResponse.json(
        { error: "PAYMENT_TIMEOUT", order_id: order.id, status: order.status },
        { status: 504 },
      );
    }
    console.error("video sipariş checkout oturumu açılamadı", order.id, error);
    return NextResponse.json(
      { error: "PAYMENT_PROVIDER_ERROR", retryable: true },
      { status: 502 },
    );
  }
}
