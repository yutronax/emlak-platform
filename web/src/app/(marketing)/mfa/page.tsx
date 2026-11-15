import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";

import { MfaForm } from "./mfa-form";

function MfaShell({ text, children }: { text: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm font-body">
        <h1 className="font-display text-[2rem] leading-tight font-normal tracking-[-0.035em]">
          Yönetici doğrulaması
        </h1>
        <p className="mt-2 text-sm text-slate-500">{text}</p>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

// Yalnız admin; aal2 ise doğrudan admin paneline. MFA kurulumu/doğrulaması bu sayfada.
export default async function MfaPage(_props: unknown) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/login");
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("is_admin")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!agent?.is_admin) {
    notFound();
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") {
    redirect("/admin/listings");
  }

  // AC-S3: yalnız oturum sahibinin faktörleri (argümansız listFactors).
  const { data: factorData } = await supabase.auth.mfa.listFactors();
  const totp = factorData?.totp ?? [];

  const verified = totp.find((factor) => factor.status === "verified");
  if (verified) {
    return (
      <MfaShell text="Uygulamanızdaki 6 haneli kodu girin.">
        <MfaForm factorId={verified.id} />
      </MfaShell>
    );
  }

  // Doğrulanmamış (yarım kalmış) faktörler yenisinden önce temizlenir.
  for (const factor of totp) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Admin",
  });
  if (enrollError || !enrolled?.totp) {
    return (
      <MfaShell text="Kurulum başlatılamadı.">
        <Alert variant="error">Kurulum başlatılamadı. Sayfayı yenileyip tekrar deneyin.</Alert>
      </MfaShell>
    );
  }

  return (
    <MfaShell text="Google Authenticator gibi bir uygulamayla QR kodu okutun, uygulamadaki 6 haneli kodu girin.">
      <div className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- Supabase'in ürettiği SVG data URL; boyut sabit */}
        <img src={enrolled.totp.qr_code} alt="MFA QR kodu" width={192} height={192} className="h-48 w-48" />
        <p className="text-sm text-slate-500">QR okutamazsanız bu anahtarı elle girin:</p>
        <code className="break-all font-mono text-sm">{enrolled.totp.secret}</code>
      </div>
      <div className="mt-6">
        <MfaForm factorId={enrolled.id} />
      </div>
    </MfaShell>
  );
}
