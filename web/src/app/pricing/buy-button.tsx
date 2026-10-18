"use client";

import { useState } from "react";

function messageForStatus(status: number): string {
  if (status === 401) return "Ödeme için önce giriş yapmanız gerekiyor.";
  if (status === 409) return "Zaten bu plandasınız.";
  if (status === 429) return "Çok fazla istek gönderildi, biraz bekleyin.";
  return "Ödeme başlatılamadı, lütfen tekrar deneyin.";
}

export function BuyButton({ planId }: { planId: string }) {
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
        className="rounded bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-50"
      >
        Satın Al
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
