"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { rejectOrder } from "../actions";

const GENERIC_ERROR = "Bir hata oluştu, lütfen tekrar deneyin.";
const MIN_REASON_LENGTH = 5;

export function RejectForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const textareaId = useId();
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function askConfirmation() {
    if (reason.trim().length < MIN_REASON_LENGTH) {
      setError(`Gerekçe en az ${MIN_REASON_LENGTH} karakter olmalı.`);
      return;
    }
    setError(null);
    setConfirming(true);
  }

  async function reject() {
    setPending(true);
    setError(null);
    try {
      const result = await rejectOrder(orderId, reason.trim());
      if (!result.ok) {
        setError(result.message);
        setConfirming(false);
        return;
      }
      router.refresh();
    } catch {
      setError(GENERIC_ERROR);
      setConfirming(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={textareaId} className="font-medium">
          Reddetme gerekçesi
        </label>
        <textarea
          id={textareaId}
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={pending}
          className="w-full rounded-md border border-mist-200 bg-white px-4 py-3 text-base"
        />
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {confirming ? (
        <div className="flex flex-col gap-3 rounded-md border border-brick-700 bg-white p-4">
          <p className="font-medium">Bu talep reddedilecek.</p>
          <p className="text-sm text-slate-500">
            Talep iptal edilir ve gerekçe emlakçıya gösterilir.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" className="min-h-11" isPending={pending} onClick={reject}>
              Evet, reddet
            </Button>
            <Button
              variant="secondary"
              className="min-h-11"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Vazgeç
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" className="min-h-11 self-start" onClick={askConfirmation}>
          Reddet
        </Button>
      )}
    </div>
  );
}
