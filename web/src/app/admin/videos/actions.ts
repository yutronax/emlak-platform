import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/requireAdmin";

const BUCKET = "property-videos";
const ALLOWED_MIME = ["video/mp4", "video/webm", "video/quicktime"];
const ALLOWED_EXT = ["mp4", "webm", "mov"];
const MAX_BYTES = 52428800; // 50MB

/**
 * Storage yolunu SUNUCUDA üretir: `${propertyId}/${uuid}.${ext}`.
 * Dosya adının yalnızca uzantısı kullanılır (izinli listeyle); dosya adının
 * geri kalanı yola girmez, path manipülasyonu tasarımla engellenir.
 */
export function buildVideoStoragePath(propertyId: string, filename: string): string {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    throw new Error("Sadece MP4, WebM veya MOV yükleyebilirsiniz");
  }
  return `${propertyId}/${randomUUID()}.${ext}`;
}

export async function uploadVideo(formData: FormData): Promise<void> {
  "use server";
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "no-session") {
      redirect("/login");
    }
    throw new Error("Bu işlem için yetkiniz yok");
  }
  const { supabase } = auth;

  const propertyId = String(formData.get("property_id") ?? "");
  if (!propertyId) {
    throw new Error("Geçersiz mülk");
  }

  // Property kontrolü format/boyut kontrolünden ÖNCE — erken çıkış.
  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .maybeSingle();
  if (!property) {
    throw new Error("Geçersiz mülk");
  }

  const file = formData.get("video");
  if (!file || typeof file === "string" || !ALLOWED_MIME.includes(file.type)) {
    throw new Error("Sadece MP4, WebM veya MOV yükleyebilirsiniz");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Dosya 50MB sınırını aşıyor");
  }

  const path = buildVideoStoragePath(propertyId, file.name);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type });
  if (uploadError) {
    console.error("Video yüklenemedi", uploadError);
    throw new Error("Video yüklenemedi, lütfen tekrar deneyin");
  }

  const { error: insertError } = await supabase
    .from("property_videos")
    .insert({ property_id: propertyId, storage_path: path, status: "draft" });
  if (insertError) {
    // En iyi çaba: yetim Storage dosyasını temizle; başarısızsa path'i logla.
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([path]);
    if (removeError) {
      console.error("Yetim video dosyası silinemedi", { path, error: removeError });
    }
    console.error("Video kaydedilemedi", insertError);
    throw new Error("Video kaydedilemedi, lütfen tekrar deneyin");
  }

  revalidatePath("/admin/videos");
}

export async function publishVideo(formData: FormData): Promise<void> {
  "use server";
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "no-session") {
      redirect("/login");
    }
    throw new Error("Bu işlem için yetkiniz yok");
  }
  const { supabase } = auth;

  const videoId = String(formData.get("video_id") ?? "");
  if (!videoId) {
    throw new Error("Geçersiz video");
  }

  // Idempotent: yalnızca draft satır güncellenir; zaten published ise 0 satır etkilenir, hata yok.
  const { error } = await supabase
    .from("property_videos")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", videoId)
    .eq("status", "draft");

  if (error) {
    console.error("Video yayınlanamadı", error);
    throw new Error("Video yayınlanamadı, lütfen tekrar deneyin");
  }

  revalidatePath("/admin/videos");
}
