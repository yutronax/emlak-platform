import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

import EnrollForm from "./enroll-form";
import { MfaForm } from "./mfa-form";

// Blocking route: render'da Date.now vb. prerender uyarısını önler (admin layout ile aynı yaklaşım).
// Render'da MFA kurulumu/temizliği YAPILMAZ; kurulum yalnız EnrollForm'un butonuyla başlar.
export const instant = false;

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

// Yalnız admin; aal2 ise doğrudan admin paneline.
export default async function MfaPage(_props: unknown) {
  await connection();
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

  // AC-S3: yalnız oturum sahibinin faktörleri (argümansız listFactors). Salt okunur.
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

  return (
    <MfaShell text="Google Authenticator gibi bir uygulamayla QR kodu okutun, uygulamadaki 6 haneli kodu girin.">
      <EnrollForm />
    </MfaShell>
  );
}
