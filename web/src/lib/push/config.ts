/**
 * VAPID yapılandırması. Env her çağrıda okunur (modül yüklenirken önbelleklenmez).
 * Herhangi biri eksikse null döner: özellik kapalıdır (AC-6 / sözleşme #8).
 * VAPID_PRIVATE_KEY yalnız sunucu modüllerinde okunur (AC-S5). Bu dosya client'a import edilmemeli.
 */
export type VapidConfig = {
  subject: string;
  publicKey: string;
  privateKey: string;
};

export function getVapidConfig(): VapidConfig | null {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}
