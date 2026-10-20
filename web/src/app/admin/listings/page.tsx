import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/requireAdmin";

import { approveListing, rejectListing } from "./actions";

type ParsedListing = {
  title?: string | null;
  price?: number | null;
  currency?: string | null;
  rooms?: string | null;
  area_m2?: number | null;
  city?: string | null;
  district?: string | null;
  neighborhood?: string | null;
  description?: string | null;
};

type RawListingRow = {
  id: string;
  source_group: string | null;
  raw_text: string;
  parsed: ParsedListing;
  quality_score: number | null;
  created_at: string;
};

export default async function AdminListingsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    redirect(auth.reason === "no-session" ? "/login" : "/agent/dashboard");
  }
  const { supabase } = auth;

  const { data: rawListings, error } = await supabase
    .from("raw_listings")
    .select("id, source_group, raw_text, parsed, quality_score, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<RawListingRow[]>();

  if (error) {
    console.error("raw_listings sorgusu başarısız", error);
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-red-600">İlanlar yüklenemedi, lütfen tekrar deneyin.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold">İlan Onay Paneli</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {rawListings?.length ?? 0} incelenmemiş ilan.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {rawListings?.map((item) => (
          <article key={item.id} className="rounded border p-4">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>{item.source_group ?? "bilinmeyen grup"}</span>
              <span>skor: {item.quality_score ?? "—"}</span>
            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm">{item.raw_text}</p>

            <dl className="mt-3 grid grid-cols-2 gap-1 text-sm text-zinc-700 dark:text-zinc-300">
              <dt>Başlık</dt>
              <dd>{item.parsed.title ?? "—"}</dd>
              <dt>Fiyat</dt>
              <dd>
                {item.parsed.price ?? "—"} {item.parsed.currency ?? ""}
              </dd>
              <dt>Oda</dt>
              <dd>{item.parsed.rooms ?? "—"}</dd>
              <dt>m²</dt>
              <dd>{item.parsed.area_m2 ?? "—"}</dd>
              <dt>Konum</dt>
              <dd>
                {[item.parsed.neighborhood, item.parsed.district, item.parsed.city]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </dd>
            </dl>

            <div className="mt-4 flex gap-2">
              <form action={approveListing}>
                <input type="hidden" name="raw_listing_id" value={item.id} />
                <button
                  type="submit"
                  className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                >
                  Onayla
                </button>
              </form>
              <form action={rejectListing}>
                <input type="hidden" name="raw_listing_id" value={item.id} />
                <button
                  type="submit"
                  className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
                >
                  Reddet
                </button>
              </form>
            </div>
          </article>
        ))}

        {rawListings?.length === 0 && (
          <p className="text-sm text-zinc-500">İncelenmemiş ilan yok.</p>
        )}
      </div>
    </main>
  );
}
