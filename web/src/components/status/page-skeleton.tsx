// Panel/admin segmentleri için yükleme iskeleti (loading.tsx). Şekil, sayfaların ortak düzenine benzer:
// başlık + üç içerik kartı.
export function PageSkeleton() {
  return (
    <main
      role="status"
      aria-busy="true"
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-6 md:py-10"
    >
      <span className="sr-only">Yükleniyor…</span>
      <div aria-hidden="true" className="flex animate-pulse flex-col gap-6 motion-reduce:animate-none">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-20 rounded bg-mist-200" />
          <div className="h-8 w-56 rounded bg-mist-200" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl border border-mist-200 bg-white p-5 sm:p-8">
            <div className="h-5 w-40 rounded bg-mist-200" />
            <div className="h-4 w-full rounded bg-mist-200/70" />
            <div className="h-4 w-2/3 rounded bg-mist-200/70" />
          </div>
        ))}
      </div>
    </main>
  );
}
