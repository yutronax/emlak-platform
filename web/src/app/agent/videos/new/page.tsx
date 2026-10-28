import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";

import { OrderWizard, type ServiceOption } from "./order-wizard";

export const instant = false;

export default async function NewVideoOrderPage() {
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
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8 font-body text-ink-900">
      <h1 className="font-display text-2xl font-bold">Yeni video siparişi</h1>
      {error ? (
        <Alert variant="error">Hizmetler yüklenemedi. Lütfen sayfayı yenileyin.</Alert>
      ) : (
        <OrderWizard services={(data ?? []) as ServiceOption[]} />
      )}
    </main>
  );
}
