// Panel yükleme iskeleti (editorial): başlık, sonuç satırı ve iki ilan kartı — gerçek düzenin silueti.
// Mimari yer tutucu iskelet değildir; burada yalnız veri beklenirken nabız atan bloklar var.
// Ortak PageSkeleton (admin) değişmeden kalır.
export default function Loading() {
  return (
    <main
      role="status"
      aria-busy="true"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-12"
    >
      <span className="sr-only">İlanlar yükleniyor…</span>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="panel-skeleton h-6 w-28 rounded-full" />
          <div className="panel-skeleton h-9 w-40 rounded" />
          <div className="panel-skeleton h-4 w-72 max-w-full rounded" />
        </div>
        <div className="panel-skeleton h-11 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-xl border border-stone-200 bg-panel-surface p-4 md:grid-cols-[96px_minmax(0,1fr)] md:gap-4 md:p-5"
            >
              <div className="panel-skeleton h-16 w-16 rounded-lg md:h-24 md:w-24" />
              <div className="flex flex-col gap-2">
                <div className="panel-skeleton h-6 w-32 rounded" />
                <div className="panel-skeleton h-4 w-full rounded" />
                <div className="panel-skeleton mt-4 h-4 w-2/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
