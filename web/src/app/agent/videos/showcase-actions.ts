"use server";

import { revalidatePath } from "next/cache";

import { validatePublish, type PublishErrors, type PublishInput } from "@/lib/showcase-ui/publish";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

// Emlakçı teslim edilen videosunu vitrine çıkarır/kaldırır. Sahiplik ve sipariş durumu oturumla doğrulanır;
// yazma servis rolüyle (properties/property_videos'ta emlakçıya UPDATE politikası yok).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ShowcaseActionResult =
  | { status: "ok"; published: boolean }
  | { status: "invalid"; errors: PublishErrors }
  | { status: "error"; message: string };

const GENERIC = { status: "error", message: "İşlem tamamlanamadı. Lütfen tekrar deneyin." } as const;

async function ownedDeliveredOrder(orderId: string) {
  if (!UUID_RE.test(orderId)) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: order } = await supabase
    .from("video_orders")
    .select("id, property_id, status")
    .eq("id", orderId)
    .eq("agent_id", auth.user.id)
    .maybeSingle();
  if (!order || order.status !== "delivered") return null;
  return { order: order as { id: string; property_id: string }, agentId: auth.user.id };
}

export async function publishToShowcase(orderId: string, input: PublishInput): Promise<ShowcaseActionResult> {
  const { errors, columns } = validatePublish(input);
  if (!columns) return { status: "invalid", errors };

  const owned = await ownedDeliveredOrder(orderId);
  if (!owned) return { status: "error", message: "Bu sipariş vitrine çıkarılamaz." };
  const db = createServiceRoleClient();

  const { data: agent } = await db.from("agents").select("phone, suspended_at").eq("id", owned.agentId).maybeSingle();
  if (!agent || agent.suspended_at) return { status: "error", message: "Hesabınız vitrine ilan çıkaramaz." };
  if (!agent.phone) {
    return { status: "invalid", errors: { phoneConsent: "Önce profilinizden WhatsApp numaranızı ekleyin." } };
  }

  const now = new Date().toISOString();
  const steps = [
    await db.from("properties").update(columns).eq("id", owned.order.property_id).eq("agent_id", owned.agentId),
    await db.from("agents").update({ showcase_phone_consent_at: now }).eq("id", owned.agentId),
    await db
      .from("property_videos")
      .update({ status: "published", published_at: now })
      .eq("order_id", owned.order.id),
  ];
  const failed = steps.find((s) => s.error);
  if (failed) {
    console.error("showcase_publish_failed", { code: failed.error?.code });
    return GENERIC;
  }
  revalidatePath(`/agent/videos/${orderId}`);
  revalidatePath("/vitrin");
  return { status: "ok", published: true };
}

export async function unpublishFromShowcase(orderId: string): Promise<ShowcaseActionResult> {
  const owned = await ownedDeliveredOrder(orderId);
  if (!owned) return { status: "error", message: "Bu sipariş bulunamadı." };
  const { error } = await createServiceRoleClient()
    .from("property_videos")
    .update({ status: "draft", published_at: null })
    .eq("order_id", owned.order.id);
  if (error) {
    console.error("showcase_unpublish_failed", { code: error.code });
    return GENERIC;
  }
  revalidatePath(`/agent/videos/${orderId}`);
  revalidatePath("/vitrin");
  return { status: "ok", published: false };
}
