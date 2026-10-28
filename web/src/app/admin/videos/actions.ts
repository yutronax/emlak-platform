"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ASSET_RULES } from "@/lib/video-orders/limits";
import { type OrderStatus, canTransition } from "@/lib/video-orders/status";

const ASSET_BUCKET = "video-order-assets";
const DELIVERED_BUCKET = "property-videos";
const SIGNED_READ_TTL_SECONDS = 600;
const DELIVERY_RULES = ASSET_RULES.raw_video;
const MIN_QUOTE_MINOR_UNIT = 100;
const MAX_QUOTE_MINOR_UNIT = 10_000_000;
const REJECTION_MIN_LENGTH = 5;
const REJECTION_MAX_LENGTH = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// "1500", "1500.5", "1.500,50", "1.500" (binlik nokta) — en fazla 2 ondalık basamak.
const PRICE_RE = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2}))?$/;

export type ActionErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "INVALID_STATE"
  | "LIMIT_REACHED"
  | "UNSUPPORTED_FILE"
  | "FILE_TOO_LARGE"
  | "INTERNAL_ERROR";

export type ActionFailure = { ok: false; error: ActionErrorCode; message: string };
export type ActionResult<T = unknown> = ({ ok: true } & T) | ActionFailure;

export type UploadFileInput = { name: string; type: string; size: number };

type AdminClient = ReturnType<typeof createServiceRoleClient>;
type Gate = { ok: true; admin: AdminClient } | ActionFailure;

type OrderRow = {
  id: string;
  property_id: string;
  service_code: string;
  status: OrderStatus;
};

const MESSAGES: Record<ActionErrorCode, string> = {
  INVALID_INPUT: "Girdi geçersiz, lütfen bilgileri kontrol edin.",
  NOT_FOUND: "Sipariş bulunamadı.",
  INVALID_STATE: "Bu işlem siparişin mevcut durumunda yapılamaz.",
  LIMIT_REACHED: "Bu sipariş için dosya sınırına ulaştınız.",
  UNSUPPORTED_FILE: "Bu dosya türü desteklenmiyor.",
  FILE_TOO_LARGE: "Dosya boyutu sınırı aşıyor.",
  INTERNAL_ERROR: "Bir hata oluştu, lütfen tekrar deneyin.",
};

function fail(error: ActionErrorCode, message = MESSAGES[error]): ActionFailure {
  return { ok: false, error, message };
}

async function gate(): Promise<Gate> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "no-session") {
      redirect("/login");
    }
    return fail("NOT_FOUND");
  }
  return { ok: true, admin: createServiceRoleClient() };
}

async function loadOrder(admin: AdminClient, orderId: string): Promise<OrderRow | null> {
  if (typeof orderId !== "string" || !UUID_RE.test(orderId)) return null;
  const { data, error } = await admin
    .from("video_orders")
    .select("id, property_id, service_code, status")
    .eq("id", orderId)
    .maybeSingle();
  if (error) {
    throw new Error(`video_orders okunamadı: ${error.message}`);
  }
  return (data as OrderRow | null) ?? null;
}

function revalidateOrder(orderId: string) {
  revalidatePath("/admin/videos");
  revalidatePath(`/admin/videos/${orderId}`);
}

async function removeStoredFile(admin: AdminClient, bucket: string, path: string) {
  const { error } = await admin.storage.from(bucket).remove([path]);
  if (error) {
    console.error("Yetim dosya silinemedi", { bucket, path, error });
  }
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

function parseFileInput(file: unknown): UploadFileInput | null {
  if (typeof file !== "object" || file === null) return null;
  const raw = file as Record<string, unknown>;
  if (typeof raw.name !== "string" || raw.name.length === 0 || raw.name.length > 255) return null;
  if (typeof raw.type !== "string") return null;
  if (typeof raw.size !== "number" || !Number.isInteger(raw.size) || raw.size <= 0) return null;
  return { name: raw.name, type: raw.type, size: raw.size };
}

// Türkçe biçim ("1.500,50") ve nokta ondalık ("1500.5") kabul edilir; sonuç kuruş (integer).
function parsePriceToMinorUnit(input: string): number | null {
  const match = PRICE_RE.exec(input.trim());
  if (!match) return null;
  const whole = Number(match[1].replace(/\./g, ""));
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const minor = whole * 100 + fraction;
  if (!Number.isSafeInteger(minor)) return null;
  if (minor < MIN_QUOTE_MINOR_UNIT || minor > MAX_QUOTE_MINOR_UNIT) return null;
  return minor;
}

export async function setQuote(orderId: string, priceTl: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return g;

  const minor = typeof priceTl === "string" ? parsePriceToMinorUnit(priceTl) : null;
  if (minor === null) {
    return fail("INVALID_INPUT", "Fiyat 1 TL ile 100.000 TL arasında olmalı (ör. 1.500,50).");
  }

  const order = await loadOrder(g.admin, orderId);
  if (!order) return fail("NOT_FOUND");
  if (order.service_code !== "onsite" || !canTransition(order.status, "awaiting_payment", "admin")) {
    return fail("INVALID_STATE");
  }

  const { data: updated, error } = await g.admin
    .from("video_orders")
    .update({ price_minor_unit: minor, status: "awaiting_payment" })
    .eq("id", order.id)
    .eq("status", "quote_pending")
    .select("id");
  if (error) {
    console.error("Fiyat teklifi kaydedilemedi", error);
    return fail("INTERNAL_ERROR");
  }
  if (!updated || updated.length === 0) {
    return fail("INVALID_STATE");
  }

  revalidateOrder(order.id);
  return { ok: true };
}

export async function rejectOrder(orderId: string, reason: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return g;

  const text = typeof reason === "string" ? reason.trim() : "";
  if (text.length < REJECTION_MIN_LENGTH || text.length > REJECTION_MAX_LENGTH) {
    return fail("INVALID_INPUT", "Red gerekçesi 5-500 karakter olmalı.");
  }

  const order = await loadOrder(g.admin, orderId);
  if (!order) return fail("NOT_FOUND");
  if (!canTransition(order.status, "canceled", "admin")) {
    return fail("INVALID_STATE");
  }

  const { data: updated, error } = await g.admin
    .from("video_orders")
    .update({ status: "canceled", rejection_reason: text })
    .eq("id", order.id)
    .eq("status", "quote_pending")
    .select("id");
  if (error) {
    console.error("Sipariş reddedilemedi", error);
    return fail("INTERNAL_ERROR");
  }
  if (!updated || updated.length === 0) {
    return fail("INVALID_STATE");
  }

  revalidateOrder(order.id);
  return { ok: true };
}

export async function getAssetDownloadUrl(
  orderId: string,
  assetId: string,
): Promise<ActionResult<{ url: string }>> {
  const g = await gate();
  if (!g.ok) return g;

  if (typeof orderId !== "string" || !UUID_RE.test(orderId)) return fail("NOT_FOUND");
  if (typeof assetId !== "string" || !UUID_RE.test(assetId)) return fail("INVALID_INPUT");

  const { data: asset, error } = await g.admin
    .from("video_order_assets")
    .select("id, storage_path")
    .eq("id", assetId)
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) {
    throw new Error(`video_order_assets okunamadı: ${error.message}`);
  }
  if (!asset) return fail("NOT_FOUND");

  const { data, error: signError } = await g.admin.storage
    .from(ASSET_BUCKET)
    .createSignedUrl(asset.storage_path, SIGNED_READ_TTL_SECONDS, { download: true });
  if (signError || !data) {
    console.error("İndirme URL'si üretilemedi", signError);
    return fail("INTERNAL_ERROR");
  }

  return { ok: true, url: data.signedUrl };
}

export async function requestDeliveryUploadUrl(
  orderId: string,
  file: UploadFileInput,
): Promise<ActionResult<{ path: string; signedUrl: string; token: string }>> {
  const g = await gate();
  if (!g.ok) return g;

  const parsed = parseFileInput(file);
  if (!parsed) return fail("INVALID_INPUT");

  const ext = extensionOf(parsed.name);
  if (!DELIVERY_RULES.extensions.includes(ext) || !DELIVERY_RULES.mimeTypes.includes(parsed.type)) {
    return fail("UNSUPPORTED_FILE");
  }
  if (parsed.size > DELIVERY_RULES.maxBytes) {
    return fail("FILE_TOO_LARGE");
  }

  const order = await loadOrder(g.admin, orderId);
  if (!order) return fail("NOT_FOUND");
  if (!canTransition(order.status, "delivered", "admin")) {
    return fail("INVALID_STATE");
  }

  const path = `${order.property_id}/${order.id}/${randomUUID()}.${ext}`;
  const { data, error } = await g.admin.storage.from(DELIVERED_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("Teslim yükleme URL'si üretilemedi", error);
    return fail("INTERNAL_ERROR");
  }

  return { ok: true, path, signedUrl: data.signedUrl, token: data.token };
}

export async function confirmDelivery(orderId: string, path: string): Promise<ActionResult> {
  const g = await gate();
  if (!g.ok) return g;

  if (typeof path !== "string") return fail("INVALID_INPUT");

  const order = await loadOrder(g.admin, orderId);
  if (!order) return fail("NOT_FOUND");
  if (!canTransition(order.status, "delivered", "admin")) {
    return fail("INVALID_STATE");
  }

  const prefix = `${order.property_id}/${order.id}/`;
  if (!path.startsWith(prefix)) return fail("INVALID_INPUT");
  const fileName = path.slice(prefix.length);
  const dot = fileName.lastIndexOf(".");
  const baseName = dot === -1 ? "" : fileName.slice(0, dot);
  if (!UUID_RE.test(baseName)) return fail("INVALID_INPUT");
  if (!DELIVERY_RULES.extensions.includes(extensionOf(fileName))) return fail("UNSUPPORTED_FILE");

  const { data: files, error: listError } = await g.admin.storage
    .from(DELIVERED_BUCKET)
    .list(`${order.property_id}/${order.id}`, { search: fileName });
  if (listError) {
    console.error("Teslim dosyası listelenemedi", listError);
    return fail("INTERNAL_ERROR");
  }
  if (!(files ?? []).some((entry) => entry.name === fileName)) {
    return fail("INVALID_INPUT", "Yüklenen dosya bulunamadı, lütfen tekrar yükleyin.");
  }

  const now = new Date().toISOString();
  const { data: video, error: insertError } = await g.admin
    .from("property_videos")
    .insert({
      property_id: order.property_id,
      order_id: order.id,
      storage_path: path,
      status: "published",
      published_at: now,
    })
    .select("id")
    .single();
  if (insertError || !video) {
    await removeStoredFile(g.admin, DELIVERED_BUCKET, path);
    if (insertError?.code === "23505") return fail("INVALID_STATE");
    console.error("Teslim videosu kaydedilemedi", insertError);
    return fail("INTERNAL_ERROR");
  }

  const { data: updated, error: updateError } = await g.admin
    .from("video_orders")
    .update({ status: "delivered", delivered_at: now })
    .eq("id", order.id)
    .eq("status", "in_progress")
    .select("id");
  if (updateError || !updated || updated.length === 0) {
    const { error: rollbackError } = await g.admin.from("property_videos").delete().eq("id", video.id);
    if (rollbackError) {
      console.error("Teslim satırı geri alınamadı", rollbackError);
    }
    await removeStoredFile(g.admin, DELIVERED_BUCKET, path);
    if (updateError) {
      console.error("Sipariş teslim edildi olarak işaretlenemedi", updateError);
      return fail("INTERNAL_ERROR");
    }
    return fail("INVALID_STATE");
  }

  revalidateOrder(order.id);
  return { ok: true };
}
