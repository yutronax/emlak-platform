"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { SUPPORT_WHATSAPP_URL } from "@/lib/contact";
import { paymentsEnabled } from "@/lib/payments/enabled";

type BuyButtonVariant = "primary" | "secondary" | "inverse";

const baseClass =
  "w-full rounded-leaf px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600 disabled:opacity-50";

const variantClass: Record<BuyButtonVariant, string> = {
  primary: "bg-ink-900 text-white hover:bg-ink-800",
  secondary: "border border-ink-900 bg-transparent text-ink-900 hover:bg-ink-900/5",
  inverse: "bg-cream-50 text-ink-900 hover:bg-white",
};

function messageForStatus(status: number): string {
  if (status === 401) return "Ödeme için önce giriş yapmanız gerekiyor.";
  if (status === 409) return "Zaten bu plandasınız.";
  if (status === 429) return "Çok fazla istek gönderildi, biraz bekleyin.";
  return "Ödeme başlatılamadı, lütfen tekrar deneyin.";
}

export function BuyButton({
  planId,
  label,
  variant = "primary",
}: {
  planId: string;
  label: string;
  variant?: BuyButtonVariant;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kartla ödeme kapalıyken abonelik WhatsApp üzerinden elle başlatılır (admin uzatır).
  if (!paymentsEnabled()) {
    return (
      <div className="flex flex-col gap-2">
        <a
          href={`${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(`${label}: abonelik başlatmak istiyorum.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${baseClass} ${variantClass[variant]} text-center`}
        >
          WhatsApp&apos;tan abone ol<span className="sr-only"> (yeni sekmede açılır)</span>
        </a>
        <p className="text-xs opacity-70">Kartla ödeme yakında. Şimdilik aboneliğinizi biz başlatıyoruz.</p>
      </div>
    );
  }

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId }),
      });
      const data = (await response.json().catch(() => null)) as
        | { checkout_url?: unknown }
        | null;
      if (response.status === 201 && typeof data?.checkout_url === "string") {
        window.location.href = data.checkout_url;
        return;
      }
      setError(messageForStatus(response.status));
    } catch {
      setError("Bağlantı hatası oluştu, lütfen tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`${baseClass} ${variantClass[variant]}`}
      >
        {label}
      </button>
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
