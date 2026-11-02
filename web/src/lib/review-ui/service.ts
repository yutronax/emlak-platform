import {
  reviewApprove,
  reviewCities,
  reviewGetThreshold,
  reviewList,
  reviewReject,
  reviewSaveThreshold,
} from "@/app/admin/listings/review-actions";

import { scoreBand } from "./edits";
import type { ReviewItem, ReviewService } from "./types";

// Yalnız dev: NEXT_PUBLIC_ADMIN_MOCK=1 (admin oturumu yine gerekir). 26 ilan → 2 sayfa.
// Tetikleyiciler: başlıkta "hata" → işlem hatası, id "r5" → başka yönetici işledi (gone).
const GROUPS = ["İzmir Emlakçılar", "Bodrum Gayrimenkul Paylaşım", null];
const PLACES = [
  ["İzmir", "Bornova"],
  ["İzmir", "Karşıyaka"],
  ["Muğla", "Bodrum"],
  ["İzmir", "Buca"],
  ["Ankara", "Çankaya"],
] as const;

function fixture(): ReviewItem[] {
  return Array.from({ length: 26 }, (_, i) => {
    const [city, district] = PLACES[i % PLACES.length];
    const rooms = ["1+1", "2+1", "3+1", "4+1"][i % 4];
    const personal = i % 6 === 2;
    const title = i === 3 ? "" : `${district} ${rooms}${i % 5 === 0 ? " deniz manzaralı, site içinde, otoparklı, asansörlü geniş daire" : ""}`;
    return {
      id: `r${i + 1}`,
      rawText: `${i % 2 ? "KİRALIK" : "SATILIK"} ${district.toLocaleUpperCase("tr-TR")} ${rooms}\n${120 - i} m², ${i + 1}. kat\nFiyat: ${(4_500_000 + i * 85_000).toLocaleString("tr-TR")} TL\nİletişim için yazın 📞`,
      sourceGroup: personal ? null : GROUPS[i % GROUPS.length],
      owner: personal ? { companyName: "Karşıyaka Sahil Gayrimenkul" } : null,
      score: i % 7 === 0 ? null : Math.round(((i * 37) % 100) / 100 * 100) / 100,
      createdAt: new Date(Date.UTC(2026, 10, 1, 9) - i * 47 * 60_000).toISOString(),
      parsed: {
        title,
        price: i % 9 === 4 ? null : 4_500_000 + i * 85_000,
        currency: "TRY",
        rooms,
        areaM2: 120 - i,
        city,
        district,
        neighborhood: "",
        description: "",
      },
    };
  });
}

function createMockReviewService(delayMs = 500): ReviewService {
  let items = fixture();
  let threshold = 0.7;
  const wait = () => new Promise((r) => setTimeout(r, delayMs));
  const PAGE = 20;

  return {
    kind: "mock",
    async list(q) {
      await wait();
      const needle = q.q?.toLocaleLowerCase("tr-TR");
      let out = items.filter(
        (i) =>
          (!needle || `${i.parsed.title} ${i.rawText}`.toLocaleLowerCase("tr-TR").includes(needle)) &&
          (!q.city || i.parsed.city === q.city) &&
          (!q.source || (q.source === "personal" ? i.owner !== null : i.owner === null)) &&
          (!q.score || scoreBand(i.score) === q.score),
      );
      out = out.sort((a, b) => (q.order === "oldest" ? 1 : -1) * a.createdAt.localeCompare(b.createdAt));
      const start = (q.page - 1) * PAGE;
      return { status: "ok", items: out.slice(start, start + PAGE), total: out.length, page: q.page, pageSize: PAGE };
    },
    async cities() {
      return [...new Set(items.map((i) => i.parsed.city))].sort((a, b) => a.localeCompare(b, "tr"));
    },
    async approve(id, edits) {
      await wait();
      if (edits.title?.toLowerCase().includes("hata")) return { status: "error" };
      items = items.filter((i) => i.id !== id);
      return id === "r5" ? { status: "gone" } : { status: "ok" };
    },
    async reject(id) {
      await wait();
      items = items.filter((i) => i.id !== id);
      return { status: "ok" };
    },
    async getThreshold() {
      return { value: threshold, failed: false };
    },
    async saveThreshold(v) {
      await wait();
      threshold = v;
      return { ok: true };
    },
  };
}

// Sunucu aksiyonlarının istemci sarmalayıcısı.
export const realReviewService: ReviewService = {
  kind: "real",
  list: (q) => reviewList(q),
  cities: () => reviewCities(),
  approve: (id, edits) => reviewApprove(id, edits),
  reject: (id, reason, note) => reviewReject(id, reason, note),
  getThreshold: () => reviewGetThreshold(),
  saveThreshold: (v) => reviewSaveThreshold(v),
};

// Varsayılan gerçek servis; mock yalnız dev'de bayrakla.
export function selectReviewService(env: { nodeEnv: string | undefined; mockFlag: string | undefined }): ReviewService {
  if (env.mockFlag === "1") {
    if (env.nodeEnv === "production") throw new Error("Admin mock servisi production'da kullanılamaz.");
    return createMockReviewService();
  }
  return realReviewService;
}

export function getReviewService(): ReviewService {
  return selectReviewService({ nodeEnv: process.env.NODE_ENV, mockFlag: process.env.NEXT_PUBLIC_ADMIN_MOCK });
}
