import { redirect } from "next/navigation";
import { connection } from "next/server";

import { Alert } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";

import { OrderWizard, type ServiceOption } from "./order-wizard";

export const instant = false;

export default async function NewVideoOrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // getUser() Date.now() kullanır; dashboard/fiyatlar/WhatsApp ile aynı istek-zamanlı işaretleme.
  await connection();
  const params = await searchParams;
  // İlan kartından gelen başlık (?baslik=...) mülk adımına hazır dolar; kullanıcı değiştirebilir.
  const initialTitle = typeof params.baslik === "string" ? params.baslik.trim().slice(0, 120) : "";

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("video_services")
    .select("code, name, price_minor_unit, sort_order")
    .order("sort_order", { ascending: true });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6 font-body text-ink-900 md:py-10">
      <div className="panel-enter">
        <p className="inline-flex rounded-full bg-panel-accent-soft px-2.5 py-1 text-[0.6875rem] font-semibold tracking-[0.08em] text-terracotta-700 uppercase">
          Dikey video · 9:16
        </p>
        <h1 className="mt-3 font-display text-[1.75rem] leading-tight tracking-[-0.02em] md:text-4xl">
          Yeni video siparişi
        </h1>
      </div>
      {error ? (
        <Alert variant="error">Hizmetler yüklenemedi. Lütfen sayfayı yenileyin.</Alert>
      ) : (
        <OrderWizard services={(data ?? []) as ServiceOption[]} initialTitle={initialTitle} />
      )}
    </main>
  );
}
