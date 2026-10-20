import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

const CHECKOUT_TTL_MS = 30 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 10_000;

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
): boolean {
  const secret = process.env.IYZICO_WEBHOOK_SECRET;
  if (!signatureHeader || !secret) return false;

  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"));
  const received = Buffer.from(signatureHeader);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function authorizationHeaders(requestBody: string): Record<string, string> {
  const apiKey = process.env.IYZICO_API_KEY ?? "";
  const secretKey = process.env.IYZICO_SECRET_KEY ?? "";
  const randomKey = String(Date.now());
  const hash = createHash("sha1")
    .update(apiKey + randomKey + secretKey + requestBody)
    .digest("base64");

  return {
    "content-type": "application/json",
    authorization: `IYZWS ${apiKey}:${hash}`,
    "x-iyzi-rnd": randomKey,
  };
}

export async function createCheckoutSession(
  planId: string,
  agentId: string,
): Promise<{ checkout_url: string; expires_at: string }> {
  const supabase = await createClient();
  const { data: plan, error } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (error || !plan) {
    throw new Error("Plan fiyatı okunamadı");
  }

  const requestBody = JSON.stringify({
    locale: "tr",
    conversationId: agentId,
    // plans.price_minor_unit kuruş cinsinden integer; sağlayıcı API'si TL bekler.
    price: (Number(plan.price_minor_unit) / 100).toFixed(2),
    currency: plan.currency,
    basketId: plan.id,
    paymentGroup: "SUBSCRIPTION",
  });

  const response = await fetch(
    `${process.env.IYZICO_BASE_URL}/payment/iyzipos/checkoutform/initialize/auth/ecom`,
    {
      method: "POST",
      headers: authorizationHeaders(requestBody),
      body: requestBody,
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    },
  );

  const responseText = await response.text();
  if (!response.ok) {
    console.error("iyzico checkout HTTP hatası", response.status, responseText);
    throw new Error("PAYMENT_PROVIDER_ERROR");
  }

  const data = JSON.parse(responseText) as { status?: string; paymentPageUrl?: string };
  if (data.status !== "success" || !data.paymentPageUrl) {
    console.error("iyzico checkout başarısız yanıt", responseText);
    throw new Error("PAYMENT_PROVIDER_ERROR");
  }

  return {
    checkout_url: data.paymentPageUrl,
    expires_at: new Date(Date.now() + CHECKOUT_TTL_MS).toISOString(),
  };
}
