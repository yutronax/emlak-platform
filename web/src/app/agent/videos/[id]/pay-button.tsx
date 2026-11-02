"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SUPPORT_WHATSAPP_URL } from "@/lib/contact";
import { paymentsEnabled } from "@/lib/payments/enabled";
import { DELIVERY_BUSINESS_DAYS } from "@/lib/video-orders/limits";

function messageFor(status: number, code: string | null): string {
  if (status === 401) return "Oturumunuz kapanmış, lütfen tekrar giriş yapın.";
  if (status === 404) return "Sipariş bulunamadı.";
  if (status === 409) {
    return code === "QUOTE_PENDING"
      ? "Fiyat teklifi henüz verilmedi."
      : "Bu sipariş şu an ödenemez. Sayfayı yenileyin.";
  }
  if (status === 429) return "Çok fazla deneme yaptınız, biraz bekleyin.";
  if (status === 504) return "Ödeme sayfası zamanında açılamadı. Tekrar deneyin.";
  return "Ödeme sayfası açılamadı. Tekrar deneyin.";
}

export function PayButton({ orderId, amountLabel }: { orderId: string; amountLabel: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kartla ödeme kapalıyken ödeme havale/elden alınır; admin "ödeme alındı" deyince hazırlık başlar.
  if (!paymentsEnabled()) {
    return (
      <div className="flex flex-col gap-3">
        <a
          href={`${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(`Video siparişi ${orderId} için ödeme yapmak istiyorum (${amountLabel}).`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-leaf bg-ink-900 px-4 py-2 text-base font-medium text-white hover:bg-ink-800"
        >
          Ödeme için WhatsApp&apos;tan yazın ({amountLabel})<span className="sr-only"> (yeni sekmede açılır)</span>
        </a>
        <p className="text-sm text-slate-500">
          Kartla ödeme yakında. Ödemeniz alındığında videonuz {DELIVERY_BUSINESS_DAYS} iş günü içinde hazırlanır.
        </p>
      </div>
    );
  }

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/video-orders/${orderId}/checkout`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as
        | { checkout_url?: unknown; error?: unknown }
        | null;
      if (response.status === 201 && typeof data?.checkout_url === "string") {
        if (!data.checkout_url.startsWith("https://")) {
          setError(messageFor(502, null));
          setPending(false);
          return;
        }
        window.location.assign(data.checkout_url);
        return;
      }
      const code = typeof data?.error === "string" ? data.error : null;
      setError(messageFor(response.status, code));
      setPending(false);
    } catch {
      setError("Ödeme sayfası açılamadı. Tekrar deneyin.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        onClick={handleClick}
        isPending={pending}
        className="min-h-12 w-full text-base"
      >
        {pending ? "Ödeme sayfası açılıyor…" : `Öde (${amountLabel})`}
      </Button>
      <p className="text-sm text-slate-500">
        Güvenli ödeme sayfasına yönlendirileceksiniz. Ödemeden sonra videonuz{" "}
        {DELIVERY_BUSINESS_DAYS} iş günü içinde hazırlanır.
      </p>
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
