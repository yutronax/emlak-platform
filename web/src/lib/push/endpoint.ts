/**
 * AC-S2 — push endpoint allowlist (SSRF koruması).
 * Yalnız https ve bilinen tarayıcı push servisleri kabul edilir. Alt alan eşleşmesi
 * sonek ile yapılır: "fcm.googleapis.com.evil.com" veya "evilpush.apple.com" reddedilir.
 */
const EXACT_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
]);

const SUFFIX_HOSTS = [".push.apple.com", ".notify.windows.com"];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (typeof endpoint !== "string" || endpoint.length === 0) return false;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (url.username !== "" || url.password !== "") return false;
  // Host'tan hemen sonra ":port", "@", "?" veya "#" gelmez (URL normalizasyonu :443 gibi portları
  // siler; DB CHECK kısıtı ile aynı küme kalsın diye ham string'e bakılır).
  if (/^https:\/\/[^/]*[:@?#]/i.test(endpoint)) return false;

  const host = url.hostname.toLowerCase();
  if (EXACT_HOSTS.has(host)) return true;
  return SUFFIX_HOSTS.some((suffix) => host.endsWith(suffix));
}

/** p256dh / auth anahtarları: base64url (padding yok), 1–200 karakter. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

export function isValidKey(value: string): boolean {
  return typeof value === "string" && KEY_PATTERN.test(value);
}
