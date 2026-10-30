// Landing hero'sunda, panelin ilan akışını telefon çerçevesinde gösteren
// dekoratif-ama-bilgilendirici mockup. Tüm veri sabit örnektir; API çağrısı yok.
// Görünüm, agent/dashboard/listing-card.tsx ve dashboard sayfasını taklit eder.

const FILTER_CHIPS = ["İstanbul", "Anadolu Yakası", "Tüm gruplar"];

const SAMPLE_LISTINGS = [
  {
    group: "Kadıköy Emlakçılar",
    title: "Kadıköy 3+1 Satılık Daire",
    price: "2.450.000 ₺",
    rooms: "3+1",
    area: "120 m²",
    location: "Kadıköy / İstanbul",
    arrival: "5 dk önce",
  },
  {
    group: "Ataşehir Kiralık Portföy",
    title: "Ataşehir 2+1 Kiralık Daire",
    price: "28.000 ₺",
    rooms: "2+1",
    area: "95 m²",
    location: "Ataşehir / İstanbul",
    arrival: "5 dk önce",
  },
  {
    group: "Anadolu Yakası Emlak",
    title: "Üsküdar 4+1 Satılık Villa",
    price: "9.800.000 ₺",
    rooms: "4+1",
    area: "210 m²",
    location: "Üsküdar / İstanbul",
    arrival: "5 dk önce",
  },
];

export function HeroPhoneMockup() {
  return (
    <div
      role="img"
      aria-label="Panelde ilan akışı örneği: filtrelenmiş üç ilan kartı"
      className="mx-auto w-[280px] rounded-[2.5rem] bg-ink-900 p-2 shadow-xl md:w-[300px]"
    >
      <div
        aria-hidden="true"
        className="relative flex h-[520px] flex-col overflow-hidden rounded-[2rem] bg-fog-50 font-body text-ink-900"
      >
        <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-ink-900" />

        <div className="flex flex-col gap-3 px-4 pb-3 pt-10">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-lg font-semibold">İlanlar</p>
            <span className="whitespace-nowrap rounded-full bg-terracotta-600 px-2.5 py-0.5 text-xs font-medium text-white">
              3 yeni
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTER_CHIPS.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-mist-200 bg-white px-2.5 py-1 text-xs text-ink-900"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pb-4">
          {SAMPLE_LISTINGS.map((listing) => (
            <li
              key={listing.title}
              className="min-w-0 rounded-md border border-mist-200 bg-white p-3"
            >
              <p className="text-xs text-slate-500">{listing.group}</p>
              <p className="mt-1 text-sm font-medium text-ink-900">{listing.title}</p>
              <p className="mt-1.5 text-sm font-semibold text-ink-900">{listing.price}</p>
              <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-500">
                <span>{listing.rooms}</span>
                <span>{listing.area}</span>
                <span>{listing.location}</span>
                <span>{listing.arrival}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
