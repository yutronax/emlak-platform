"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { startEnrollment } from "./actions";
import { MfaForm } from "./mfa-form";

type Enrollment = { factorId: string; qr: string; secret: string };

// Kurulum: buton bir kez startEnrollment'ı çağırır; QR/secret/factorId state'te kalır,
// yanlış kodda yeniden kurulum yapılmaz.
export default function EnrollForm() {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function start() {
    setIsPending(true);
    setError(null);
    try {
      const result = await startEnrollment();
      if (result.status === "ok") {
        setEnrollment({ factorId: result.factorId, qr: result.qr, secret: result.secret });
      } else {
        setError(result.message);
      }
    } finally {
      setIsPending(false);
    }
  }

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}
        <Button type="button" onClick={start} isPending={isPending} className="py-2.5">
          Kurulumu başlat
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- Supabase'in ürettiği SVG data URL; boyut sabit */}
        <img src={enrollment.qr} alt="MFA QR kodu" width={192} height={192} className="h-48 w-48" />
        <p className="text-sm text-slate-500">QR okutamazsanız bu anahtarı elle girin:</p>
        <code className="break-all font-mono text-sm">{enrollment.secret}</code>
      </div>
      <MfaForm factorId={enrollment.factorId} />
    </div>
  );
}
