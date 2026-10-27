"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";

type BuyButtonVariant = "primary" | "inverse";

const baseClass =
  "w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50";

const variantClass: Record<BuyButtonVariant, string> = {
  primary: "bg-terracotta-600 text-white hover:bg-terracotta-700",
  inverse: "bg-white text-ink-900 hover:bg-mist-200",
};

function messageForStatus(status: number): string {
  if (status === 401) return "Ödeme için önce giriş yapmanız gerekiyor.";
  if (status === 409) return "Zaten bu plandasınız.";
  if (status === 429) return "Çok fazla istek gönderildi, biraz bekleyin.";
  return "Ödeme başlatılamadı, lütfen tekrar deneyin.";
}

export function BuyButton({
  planId,
  variant = "primary",
}: {
  planId: string;
  variant?: BuyButtonVariant;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        Satın Al
      </button>
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
