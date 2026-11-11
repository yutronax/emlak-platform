"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export type SupportResult =
  | { ok: true }
  | { ok: false; error: "INVALID_INPUT"; field?: "name" | "contact" | "message"; message: string };

const NAME_MIN = 2;
const NAME_MAX = 80;
const CONTACT_MIN = 3;
const CONTACT_MAX = 120;
const MESSAGE_MIN = 5;
const MESSAGE_MAX = 2000;

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

// Ziyaretçi "Destek" formundan mesaj bırakır (WhatsApp'a yönlendirme yok). Mesaj support_messages
// tablosuna servis rolüyle yazılır; admin panelinden okunur. Giriş yapmış kullanıcı agent_id ile
// ilişkilendirilir (anon'da null). Doğrulama sunucuda; tablo CHECK kısıtları ikinci katman.
export async function sendSupportMessage(formData: FormData): Promise<SupportResult> {
  const name = clean(formData.get("name"));
  const contact = clean(formData.get("contact"));
  const message = clean(formData.get("message"));

  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return { ok: false, error: "INVALID_INPUT", field: "name", message: "Adınızı yazın." };
  }
  if (contact.length < CONTACT_MIN || contact.length > CONTACT_MAX) {
    return { ok: false, error: "INVALID_INPUT", field: "contact", message: "Telefon veya e-posta yazın." };
  }
  if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX) {
    return { ok: false, error: "INVALID_INPUT", field: "message", message: "Mesajınızı yazın (en az 5 karakter)." };
  }

  // Giriş yapmışsa ilişkilendir; değilse anon (null). Oturum okuması başarısız olsa da mesaj kaydedilir.
  let agentId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    agentId = auth.user?.id ?? null;
  } catch {
    agentId = null;
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.from("support_messages").insert({ name, contact, message, agent_id: agentId });
  if (error) {
    console.error("support_messages insert başarısız", error);
    return { ok: false, error: "INVALID_INPUT", message: "Mesaj gönderilemedi, lütfen tekrar deneyin." };
  }
  return { ok: true };
}
