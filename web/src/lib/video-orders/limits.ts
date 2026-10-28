// Supabase planı yükseltilince ham video limiti 500 MB (524288000) olacak; bucket limiti
// (supabase/migrations/0013_video_orders.sql) da aynı değere çekilmeli.
export const MAX_FILE_BYTES = 52428800;
export const MAX_PHOTO_BYTES = 20971520;
export const MAX_PHOTOS = 30;
export const MAX_RAW_VIDEOS = 5;
export const MIN_PHOTOS = 3;
export const DELIVERY_BUSINESS_DAYS = 2;

export type ServiceCode = "photos" | "raw_video" | "onsite";
export type AssetKind = "photo" | "raw_video";

export const SERVICE_CODES: readonly ServiceCode[] = ["photos", "raw_video", "onsite"];

export const ASSET_RULES: Record<
  AssetKind,
  { mimeTypes: readonly string[]; extensions: readonly string[]; maxBytes: number; maxCount: number }
> = {
  photo: {
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
    extensions: ["jpg", "jpeg", "png", "webp", "heic"],
    maxBytes: MAX_PHOTO_BYTES,
    maxCount: MAX_PHOTOS,
  },
  raw_video: {
    mimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
    extensions: ["mp4", "mov", "webm"],
    maxBytes: MAX_FILE_BYTES,
    maxCount: MAX_RAW_VIDEOS,
  },
};

export function kindForService(code: ServiceCode): AssetKind | null {
  if (code === "photos") return "photo";
  if (code === "raw_video") return "raw_video";
  return null;
}

// Türkiye saati (UTC+3, yaz saati uygulaması yok): iş günü kontrolü yerel güne göre yapılır.
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

export function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from.getTime());
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const weekday = new Date(result.getTime() + TR_OFFSET_MS).getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return result;
}
