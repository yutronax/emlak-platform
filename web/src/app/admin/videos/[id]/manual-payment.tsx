"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { markOrderPaidManually } from "../actions";

// Kartla ödeme kapalıyken havale/elden alınan ödemeyi kaydeder; sipariş hazırlanmaya geçer.
export function ManualPayment({ orderId, amountLabel }: { orderId: string; amountLabel: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      const result = await markOrderPaidManually(orderId);
      if (!result.ok) {
        setError(result.message);
        setConfirming(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Bir hata oluştu, lütfen tekrar deneyin.");
      setConfirming(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert variant="error">{error}</Alert>}
      {confirming ? (
        <div className="flex flex-col gap-3 rounded-md border border-ink-900 bg-white p-4">
          <p className="font-medium">{amountLabel} ödemenin alındığını onaylıyor musunuz?</p>
          <p className="text-sm text-slate-500">Sipariş hazırlanıyor durumuna geçer ve teslim süresi başlar.</p>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" isPending={pending} onClick={confirm}>
              Evet, ödeme alındı
            </Button>
            <Button variant="secondary" className="min-h-11" disabled={pending} onClick={() => setConfirming(false)}>
              Vazgeç
            </Button>
          </div>
        </div>
      ) : (
        <Button className="min-h-11 self-start" onClick={() => setConfirming(true)}>
          Ödeme alındı
        </Button>
      )}
    </div>
  );
}
