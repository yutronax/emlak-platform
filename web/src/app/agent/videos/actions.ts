"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  ASSET_RULES,
  type AssetKind,
  MIN_PHOTOS,
  SERVICE_CODES,
  type ServiceCode,
  kindForService,
} from "@/lib/video-orders/limits";
import { type OrderStatus, canTransition } from "@/lib/video-orders/status";

const ASSET_BUCKET = "video-order-assets";
const DELIVERED_BUCKET = "property-videos";
const SIGNED_READ_TTL_SECONDS = 600;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export type CreateVideoOrderInput = {
  serviceCode: ServiceCode;
  title: string;
  address: string;
  onsitePreferredTime?: string;
};

export type UploadFileInput = { name: string; type: string; size: number };

type UserClient = Awaited<ReturnType<typeof createClient>>;

type OrderRow = {
  id: string;
  agent_id: string;
  property_id: string;
  service_code: ServiceCode;
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

async function requireAgent(): Promise<{ supabase: UserClient; agentId: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect("/login");
  }
  return { supabase, agentId: data.user.id };
}

// Sahiplik kontrolü: başkasının siparişi de yokmuş gibi NOT_FOUND döner.
async function loadOwnedOrder(
  supabase: UserClient,
  agentId: string,
  orderId: string,
): Promise<OrderRow | null> {
  if (!UUID_RE.test(orderId)) return null;
  const { data, error } = await supabase
    .from("video_orders")
    .select("id, agent_id, property_id, service_code, status")
    .eq("id", orderId)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) {
    throw new Error(`video_orders okunamadı: ${error.message}`);
  }
  return (data as OrderRow | null) ?? null;
}

async function countAssets(
  supabase: UserClient,
  orderId: string,
  kind: AssetKind,
): Promise<number> {
  const { count, error } = await supabase
    .from("video_order_assets")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .eq("kind", kind);
  if (error) {
    throw new Error(`video_order_assets sayılamadı: ${error.message}`);
  }
  return count ?? 0;
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

function parseCreateInput(input: unknown): (CreateVideoOrderInput & { onsitePreferredTime?: string }) | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;
  const serviceCode = raw.serviceCode;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const address = typeof raw.address === "string" ? raw.address.trim() : "";
  const time = typeof raw.onsitePreferredTime === "string" ? raw.onsitePreferredTime.trim() : "";

  if (!SERVICE_CODES.includes(serviceCode as ServiceCode)) return null;
  if (title.length < 3 || title.length > 120) return null;
  if (address.length < 5 || address.length > 300) return null;
  if (time.length > 500) return null;

  return {
    serviceCode: serviceCode as ServiceCode,
    title,
    address,
    onsitePreferredTime: time || undefined,
  };
}

function parseFileInput(file: unknown): UploadFileInput | null {
  if (typeof file !== "object" || file === null) return null;
  const raw = file as Record<string, unknown>;
  if (typeof raw.name !== "string" || raw.name.length === 0 || raw.name.length > 255) return null;
  if (typeof raw.type !== "string") return null;
  if (typeof raw.size !== "number" || !Number.isInteger(raw.size) || raw.size <= 0) return null;
  return { name: raw.name, type: raw.type, size: raw.size };
}

export async function createVideoOrder(
  input: CreateVideoOrderInput,
): Promise<ActionResult<{ orderId: string; status: OrderStatus }>> {
  const { supabase, agentId } = await requireAgent();

  const parsed = parseCreateInput(input);
  if (!parsed) {
    return fail("INVALID_INPUT");
  }

  const isOnsite = parsed.serviceCode === "onsite";
  if (isOnsite && !parsed.onsitePreferredTime) {
    return fail("INVALID_INPUT", "Yerinde çekim için uygun zaman notu girin.");
  }

  const { data: service, error: serviceError } = await supabase
    .from("video_services")
    .select("code, price_minor_unit, currency")
    .eq("code", parsed.serviceCode)
    .maybeSingle();
  if (serviceError) {
    throw new Error(`video_services okunamadı: ${serviceError.message}`);
  }
  if (!service) {
    return fail("INVALID_INPUT");
  }

  const admin = createServiceRoleClient();

  const { data: property, error: propertyError } = await admin
    .from("properties")
    .insert({ agent_id: agentId, title: parsed.title, address: parsed.address })
    .select("id")
    .single();
  if (propertyError || !property) {
    console.error("Mülk kaydedilemedi", propertyError);
    return fail("INTERNAL_ERROR");
  }

  const status: OrderStatus = isOnsite ? "quote_pending" : "draft";

  const { data: order, error: orderError } = await admin
    .from("video_orders")
    .insert({
      agent_id: agentId,
      property_id: property.id,
      service_code: parsed.serviceCode,
      status,
      price_minor_unit: isOnsite ? null : service.price_minor_unit,
      currency: service.currency,
      onsite_preferred_time: isOnsite ? parsed.onsitePreferredTime : null,
    })
    .select("id")
    .single();
  if (orderError || !order) {
    console.error("Sipariş kaydedilemedi", orderError);
    await admin.from("properties").delete().eq("id", property.id);
    return fail("INTERNAL_ERROR");
  }

  revalidatePath("/agent/videos");
  return { ok: true, orderId: order.id, status };
}

export async function requestUploadUrl(
  orderId: string,
  file: UploadFileInput,
): Promise<ActionResult<{ assetId: string; path: string; signedUrl: string; token: string }>> {
  const { supabase, agentId } = await requireAgent();

  const parsedFile = parseFileInput(file);
  if (!parsedFile) {
    return fail("INVALID_INPUT");
  }

  const order = await loadOwnedOrder(supabase, agentId, orderId);
  if (!order) {
    return fail("NOT_FOUND");
  }
  if (order.status !== "draft") {
    return fail("INVALID_STATE");
  }

  const kind = kindForService(order.service_code);
  if (!kind) {
    return fail("INVALID_STATE");
  }
  const rules = ASSET_RULES[kind];

  const ext = extensionOf(parsedFile.name);
  if (!rules.extensions.includes(ext) || !rules.mimeTypes.includes(parsedFile.type)) {
    return fail("UNSUPPORTED_FILE");
  }
  if (parsedFile.size > rules.maxBytes) {
    return fail("FILE_TOO_LARGE");
  }

  const existing = await countAssets(supabase, order.id, kind);
  if (existing >= rules.maxCount) {
    return fail("LIMIT_REACHED");
  }

  const assetId = randomUUID();
  const path = `${agentId}/${order.id}/${assetId}.${ext}`;

  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage.from(ASSET_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("Yükleme URL'si üretilemedi", error);
    return fail("INTERNAL_ERROR");
  }

  return { ok: true, assetId, path, signedUrl: data.signedUrl, token: data.token };
}

export async function confirmUpload(
  orderId: string,
  path: string,
  size: number,
): Promise<ActionResult<{ assetId: string }>> {
  const { supabase, agentId } = await requireAgent();

  if (typeof path !== "string" || !Number.isInteger(size) || size <= 0) {
    return fail("INVALID_INPUT");
  }

  const order = await loadOwnedOrder(supabase, agentId, orderId);
  if (!order) {
    return fail("NOT_FOUND");
  }
  if (order.status !== "draft") {
    return fail("INVALID_STATE");
  }

  const kind = kindForService(order.service_code);
  if (!kind) {
    return fail("INVALID_STATE");
  }
  const rules = ASSET_RULES[kind];

  const prefix = `${agentId}/${order.id}/`;
  if (!path.startsWith(prefix)) {
    return fail("INVALID_INPUT");
  }
  const fileName = path.slice(prefix.length);
  const dot = fileName.lastIndexOf(".");
  const assetId = dot === -1 ? "" : fileName.slice(0, dot);
  if (!UUID_RE.test(assetId)) {
    return fail("INVALID_INPUT");
  }
  if (!rules.extensions.includes(extensionOf(fileName))) {
    return fail("UNSUPPORTED_FILE");
  }

  const admin = createServiceRoleClient();

  const { data: files, error: listError } = await admin.storage
    .from(ASSET_BUCKET)
    .list(`${agentId}/${order.id}`, { search: fileName });
  if (listError) {
    console.error("Yüklenen dosya listelenemedi", listError);
    return fail("INTERNAL_ERROR");
  }
  const stored = (files ?? []).find((entry) => entry.name === fileName);
  if (!stored) {
    return fail("INVALID_INPUT", "Yüklenen dosya bulunamadı, lütfen tekrar yükleyin.");
  }

  const storedSize = stored.metadata?.size;
  if (typeof storedSize !== "number") {
    return fail("INTERNAL_ERROR");
  }
  if (storedSize !== size) {
    return fail("INVALID_INPUT");
  }
  if (storedSize > rules.maxBytes) {
    await admin.storage.from(ASSET_BUCKET).remove([path]);
    return fail("FILE_TOO_LARGE");
  }

  const existing = await countAssets(supabase, order.id, kind);
  if (existing >= rules.maxCount) {
    await admin.storage.from(ASSET_BUCKET).remove([path]);
    return fail("LIMIT_REACHED");
  }

  const { error: insertError } = await admin.from("video_order_assets").insert({
    id: assetId,
    order_id: order.id,
    kind,
    storage_path: path,
    size_bytes: storedSize,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: true, assetId };
    }
    if (insertError.message.includes("ASSET_LIMIT_REACHED")) {
      await admin.storage.from(ASSET_BUCKET).remove([path]);
      return fail("LIMIT_REACHED");
    }
    if (insertError.message.includes("ORDER_NOT_DRAFT")) {
      return fail("INVALID_STATE");
    }
    console.error("Dosya kaydedilemedi", insertError);
    return fail("INTERNAL_ERROR");
  }

  revalidatePath(`/agent/videos/${order.id}`);
  return { ok: true, assetId };
}

export async function removeAsset(orderId: string, assetId: string): Promise<ActionResult> {
  const { supabase, agentId } = await requireAgent();

  if (typeof assetId !== "string" || !UUID_RE.test(assetId)) {
    return fail("INVALID_INPUT");
  }

  const order = await loadOwnedOrder(supabase, agentId, orderId);
  if (!order) {
    return fail("NOT_FOUND");
  }
  if (order.status !== "draft") {
    return fail("INVALID_STATE");
  }

  const admin = createServiceRoleClient();

  const { data: asset, error: assetError } = await admin
    .from("video_order_assets")
    .select("id, storage_path")
    .eq("id", assetId)
    .eq("order_id", order.id)
    .maybeSingle();
  if (assetError) {
    throw new Error(`video_order_assets okunamadı: ${assetError.message}`);
  }
  if (!asset) {
    return fail("NOT_FOUND");
  }

  // Önce satır: DB koruması (ORDER_NOT_DRAFT) reddederse Storage'a dokunulmaz.
  const { error: deleteError } = await admin
    .from("video_order_assets")
    .delete()
    .eq("id", assetId)
    .eq("order_id", order.id);
  if (deleteError) {
    if (deleteError.message.includes("ORDER_NOT_DRAFT")) {
      return fail("INVALID_STATE");
    }
    console.error("Dosya kaydı silinemedi", deleteError);
    return fail("INTERNAL_ERROR");
  }

  const { error: removeError } = await admin.storage
    .from(ASSET_BUCKET)
    .remove([asset.storage_path]);
  if (removeError) {
    console.error("Dosya silinemedi", removeError);
    return fail("INTERNAL_ERROR");
  }

  revalidatePath(`/agent/videos/${order.id}`);
  return { ok: true };
}

export async function submitVideoOrder(
  orderId: string,
): Promise<ActionResult<{ status: OrderStatus }>> {
  const { supabase, agentId } = await requireAgent();

  const order = await loadOwnedOrder(supabase, agentId, orderId);
  if (!order) {
    return fail("NOT_FOUND");
  }
  if (!canTransition(order.status, "awaiting_payment", "agent")) {
    return fail("INVALID_STATE");
  }

  const kind = kindForService(order.service_code);
  if (!kind) {
    return fail("INVALID_STATE");
  }

  const count = await countAssets(supabase, order.id, kind);
  const minimum = kind === "photo" ? MIN_PHOTOS : 1;
  if (count < minimum) {
    return fail(
      "INVALID_INPUT",
      kind === "photo"
        ? `Siparişi göndermek için en az ${MIN_PHOTOS} fotoğraf yükleyin.`
        : "Siparişi göndermek için en az bir video yükleyin.",
    );
  }

  const admin = createServiceRoleClient();
  const { data: updated, error } = await admin
    .from("video_orders")
    .update({ status: "awaiting_payment" })
    .eq("id", order.id)
    .eq("agent_id", agentId)
    .eq("status", "draft")
    .select("id");
  if (error) {
    console.error("Sipariş gönderilemedi", error);
    return fail("INTERNAL_ERROR");
  }
  if (!updated || updated.length === 0) {
    return fail("INVALID_STATE");
  }

  revalidatePath("/agent/videos");
  revalidatePath(`/agent/videos/${order.id}`);
  return { ok: true, status: "awaiting_payment" };
}

export async function getDeliveredVideoUrl(
  orderId: string,
): Promise<ActionResult<{ url: string }>> {
  const { supabase, agentId } = await requireAgent();

  const order = await loadOwnedOrder(supabase, agentId, orderId);
  if (!order) {
    return fail("NOT_FOUND");
  }
  if (order.status !== "delivered") {
    return fail("INVALID_STATE");
  }

  const { data: video, error: videoError } = await supabase
    .from("property_videos")
    .select("storage_path")
    .eq("order_id", order.id)
    .maybeSingle();
  if (videoError) {
    throw new Error(`property_videos okunamadı: ${videoError.message}`);
  }
  if (!video) {
    return fail("INTERNAL_ERROR");
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage
    .from(DELIVERED_BUCKET)
    .createSignedUrl(video.storage_path, SIGNED_READ_TTL_SECONDS);
  if (error || !data) {
    console.error("Teslim URL'si üretilemedi", error);
    return fail("INTERNAL_ERROR");
  }

  return { ok: true, url: data.signedUrl };
}
