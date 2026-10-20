import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/payments/iyzico";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const recentRequests = new Map<string, number[]>();

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

export async function POST(request: NextRequest) {
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

  // Body'deki price (ve diğer alanlar) bilerek okunmaz: fiyat her zaman plans tablosundan gelir.
  const body = (await request.json().catch(() => null)) as { plan_id?: unknown } | null;
  const planId = typeof body?.plan_id === "string" ? body.plan_id : "";
  if (!planId) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "plan_id zorunludur", field: "plan_id" },
      { status: 400 },
    );
  }

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (planError) {
    console.error("plans sorgusu başarısız", planError);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
  if (!plan) {
    return NextResponse.json(
      { error: "PLAN_NOT_FOUND", message: "Seçilen plan bulunamadı" },
      { status: 404 },
    );
  }

  const { data: activeSubscription, error: activeError } = await supabase
    .from("subscriptions")
    .select("plan_id")
    .eq("agent_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (activeError) {
    console.error("subscriptions sorgusu başarısız", activeError);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
  if (activeSubscription) {
    return NextResponse.json(
      { error: "ALREADY_SUBSCRIBED", current_plan: activeSubscription.plan_id },
      { status: 409 },
    );
  }

  const serviceClient = createServiceRoleClient();
  const { data: subscription, error: insertError } = await serviceClient
    .from("subscriptions")
    .insert({ agent_id: userId, plan_id: plan.id, status: "pending" })
    .select("id")
    .single();
  if (insertError) {
    // Unique index (bir açık abonelik) ihlali: eşzamanlı checkout yarışı.
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "ALREADY_SUBSCRIBED" }, { status: 409 });
    }
    console.error("subscriptions insert başarısız", insertError);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }

  try {
    const session = await createCheckoutSession(plan.id, userId);
    return NextResponse.json(
      {
        subscription_id: subscription.id,
        status: "pending",
        checkout_url: session.checkout_url,
        expires_at: session.expires_at,
      },
      { status: 201 },
    );
  } catch (error) {
    if (isProviderTimeout(error)) {
      // Kayıt pending kalır; reconciliation cron'u sağlayıcıdan durumu uzlaştırır.
      return NextResponse.json(
        { error: "PAYMENT_TIMEOUT", subscription_id: subscription.id, status: "pending" },
        { status: 504 },
      );
    }
    console.error("checkout oturumu açılamadı", error);
    const { error: statusUpdateError } = await serviceClient
      .from("subscriptions")
      .update({ status: "failed" })
      .eq("id", subscription.id);
    if (statusUpdateError) {
      console.error("checkout: subscription failed-status güncellemesi başarısız", subscription.id, statusUpdateError);
    }
    return NextResponse.json(
      { error: "PAYMENT_PROVIDER_ERROR", retryable: true },
      { status: 502 },
    );
  }
}
