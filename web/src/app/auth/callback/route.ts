import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const DEFAULT_TARGET = "/agent/dashboard";

// AC-S5: yalnız "/" ile başlayan göreli yol; "//" (protokol-göreli) ve "/\" (tarayıcı ters eğik) reddedilir.
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/")) return DEFAULT_TARGET;
  if (next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_TARGET;
  return next;
}

// E-posta linkindeki code'u oturuma çevirir (şifre sıfırlama). Hata: yeni bağlantı isteme sayfası.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const target = safeNext(url.searchParams.get("next"));

  if (!code) return NextResponse.redirect(new URL("/login", url.origin));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/sifremi-unuttum", url.origin));
  }
  return NextResponse.redirect(new URL(target, url.origin));
}
