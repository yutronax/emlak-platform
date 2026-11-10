import type { ShowcaseFilters, ShowcaseItem, ShowcaseService } from "./types";

// Yalnız dev: NEXT_PUBLIC_SHOWCASE_MOCK=1. Fixture düzeni zorlar: uzun başlık, eksik olgular, kiralık/satılık karışık.
const A = { name: "Karşıyaka Sahil Gayrimenkul", phone: "+905321234567" };
const B = { name: "Bodrum Mavi Emlak", phone: "+905551112233" };

// a1–a7: video-calisma çıktılarının sessiz 9:16 önizlemeleri (public/videos/vitrin). İlk beşi
// İMZA Gayrimenkul'ün gerçek ilan çekimlerinden, izinle; ilan metinleri mock.
function item(id: string, p: Partial<ShowcaseItem> & Pick<ShowcaseItem, "title" | "deal" | "priceMinor" | "city" | "district" | "rooms" | "areaM2">): ShowcaseItem {
  return {
    id,
    floor: "3. kat",
    buildingAge: 8,
    heating: "Kombi",
    description:
      "Güney cepheli, gün boyu ışık alan daire. Ebeveyn banyolu, ankastre mutfaklı. Toplu taşımaya ve okullara yürüme mesafesinde; site içinde otopark ve çocuk oyun alanı var.",
    durationSec: 78,
    posterUrl: null,
    videoUrl: null,
    publishedAt: "2026-10-30T09:00:00Z",
    agent: A,
    ...p,
  };
}

export const SHOWCASE_FIXTURE: ShowcaseItem[] = [
  item("a1", { title: "Deniz manzaralı, yeni yapılmış site içinde geniş balkonlu 3+1 daire", deal: "satilik", priceMinor: 845_000_000, city: "İzmir", district: "Karşıyaka", rooms: "3+1", areaM2: 135, posterUrl: "/videos/vitrin/v1.jpg", videoUrl: "/videos/vitrin/v1.mp4", durationSec: 30, publishedAt: "2026-10-31T09:00:00Z" }),
  item("a2", { title: "Metroya 2 dakika eşyalı 1+1", deal: "kiralik", priceMinor: 2_200_000, city: "İzmir", district: "Bornova", rooms: "1+1", areaM2: 55, posterUrl: "/videos/vitrin/v2.jpg", videoUrl: "/videos/vitrin/v2.mp4", durationSec: 28, publishedAt: "2026-10-30T15:00:00Z" }),
  item("a3", { title: "Bahçeli müstakil villa, özel havuz", deal: "satilik", priceMinor: 2_450_000_000, city: "Muğla", district: "Bodrum", rooms: "4+1", areaM2: 260, floor: "Bahçe katı", buildingAge: 3, heating: "Yerden ısıtma", agent: B, posterUrl: "/videos/vitrin/v3.jpg", videoUrl: "/videos/vitrin/v3.mp4", durationSec: 17, publishedAt: "2026-10-29T10:00:00Z" }),
  item("a4", { title: "Öğrenciye uygun 2+1", deal: "kiralik", priceMinor: 1_750_000, city: "İzmir", district: "Buca", rooms: "2+1", areaM2: 90, buildingAge: 22, heating: null, posterUrl: "/videos/vitrin/v4.jpg", videoUrl: "/videos/vitrin/v4.mp4", durationSec: 22, publishedAt: "2026-10-28T10:00:00Z" }),
  item("a5", { title: "Yalıkavak'ta marina manzaralı rezidans dairesi", deal: "satilik", priceMinor: 1_350_000_000, city: "Muğla", district: "Bodrum", rooms: "2+1", areaM2: 110, agent: B, posterUrl: "/videos/vitrin/v5.jpg", videoUrl: "/videos/vitrin/v5.mp4", durationSec: 22, publishedAt: "2026-10-27T10:00:00Z" }),
  item("a6", { title: "Merkezi konumda ofis kullanımına uygun 3+1", deal: "kiralik", priceMinor: 3_800_000, city: "İzmir", district: "Konak", rooms: "3+1", areaM2: 140, floor: null, buildingAge: null, posterUrl: "/videos/vitrin/v6.jpg", videoUrl: "/videos/vitrin/v6.mp4", durationSec: 25, publishedAt: "2026-10-26T10:00:00Z" }),
  item("a7", { title: "Kordon'a yürüme mesafesinde 2+1", deal: "satilik", priceMinor: 615_000_000, city: "İzmir", district: "Alsancak", rooms: "2+1", areaM2: 95, posterUrl: "/videos/vitrin/v7.jpg", videoUrl: "/videos/vitrin/v7.mp4", durationSec: 18, publishedAt: "2026-10-25T10:00:00Z" }),
  item("a8", { title: "Taş ev, restore edilmiş", deal: "satilik", priceMinor: 1_120_000_000, city: "Muğla", district: "Datça", rooms: "3+1", areaM2: 150, agent: B, publishedAt: "2026-10-24T10:00:00Z" }),
  item("a9", { title: "Yeni binada sıfır 1+1", deal: "kiralik", priceMinor: 1_950_000, city: "Ankara", district: "Çankaya", rooms: "1+1", areaM2: 60, publishedAt: "2026-10-23T10:00:00Z" }),
  item("a10", { title: "Geniş aileler için 5+2 dubleks", deal: "satilik", priceMinor: 990_000_000, city: "Ankara", district: "Yenimahalle", rooms: "5+2", areaM2: 240, publishedAt: "2026-10-22T10:00:00Z" }),
  item("a11", { title: "Asansörlü binada 3+1", deal: "kiralik", priceMinor: 2_600_000, city: "Ankara", district: "Etimesgut", rooms: "3+1", areaM2: 125, publishedAt: "2026-10-21T10:00:00Z" }),
  item("a12", { title: "Bahçe katı 2+1", deal: "satilik", priceMinor: 480_000_000, city: "İzmir", district: "Çiğli", rooms: "2+1", areaM2: 100, floor: "Bahçe katı", publishedAt: "2026-10-20T10:00:00Z" }),
  item("a13", { title: "Site içinde havuzlu 4+1", deal: "kiralik", priceMinor: 6_500_000, city: "Muğla", district: "Fethiye", rooms: "4+1", areaM2: 190, agent: B, publishedAt: "2026-10-19T10:00:00Z" }),
  item("a14", { title: "Yatırımlık stüdyo", deal: "satilik", priceMinor: 285_000_000, city: "İzmir", district: "Bayraklı", rooms: "1+0", areaM2: 38, durationSec: 32, publishedAt: "2026-10-18T10:00:00Z" }),
];

const PAGE = 6;

function roomsMatch(rooms: string, f: ShowcaseFilters["rooms"]) {
  if (!f) return true;
  if (f === "4+") return Number.parseInt(rooms, 10) >= 4;
  return rooms === f;
}

export function filterFixture(f: ShowcaseFilters): ShowcaseItem[] {
  const out = SHOWCASE_FIXTURE.filter(
    (i) =>
      (!f.deal || i.deal === f.deal) &&
      (!f.city || i.city === f.city) &&
      roomsMatch(i.rooms, f.rooms) &&
      (!f.minPrice || i.priceMinor >= f.minPrice) &&
      (!f.maxPrice || i.priceMinor <= f.maxPrice),
  );
  if (f.sort === "fiyat-artan") return out.sort((a, b) => a.priceMinor - b.priceMinor);
  if (f.sort === "fiyat-azalan") return out.sort((a, b) => b.priceMinor - a.priceMinor);
  return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function createMockShowcaseService(delayMs = 500): ShowcaseService {
  const wait = () => (delayMs ? new Promise((r) => setTimeout(r, delayMs)) : Promise.resolve());
  return {
    kind: "mock",
    async cities() {
      return [...new Set(SHOWCASE_FIXTURE.map((i) => i.city))].sort((a, b) => a.localeCompare(b, "tr"));
    },
    async list(f, cursor) {
      await wait();
      // Hata durumunu denemek için: ?sehir=Hata
      if (f.city === "Hata") return { status: "error" };
      const all = filterFixture(f);
      const start = cursor ? Number(cursor) : 0;
      const items = all.slice(start, start + PAGE);
      const next = start + PAGE < all.length ? String(start + PAGE) : null;
      return { status: "ok", items, nextCursor: next, total: all.length };
    },
    async get(id) {
      await wait();
      const found = SHOWCASE_FIXTURE.find((i) => i.id === id);
      if (!found) return { status: "not_found" };
      const similar = SHOWCASE_FIXTURE.filter((i) => i.id !== id && i.city === found.city && i.deal === found.deal).slice(0, 3);
      return { status: "ok", item: found, similar };
    },
  };
}
