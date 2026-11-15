import "server-only";
import { createHash } from "node:crypto";

// Güvenlik değerlendirmesi bulgu 2: Supabase'in sızdırılmış parola koruması ücretsiz planda yok;
// aynı kontrol HaveIBeenPwned k-anonimlik API'siyle uygulamada yapılır.
// Parola gönderilmez: yalnız SHA-1 karmasının ilk 5 karakteri gider, eşleşme burada aranır.
// Servise ulaşılamazsa kayıt/şifre değişikliği engellenmez (ek katman; temel kurallar yine geçerli).

export const PWNED_PASSWORD_MESSAGE =
  "Bu şifre bilinen veri sızıntılarında görülmüş. Lütfen başka bir şifre seçin.";

const TIMEOUT_MS = 3000;

export async function isPwnedPassword(password: string): Promise<boolean> {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("pwned_password_check_unavailable", { status: res.status });
      return false;
    }
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [candidate, count] = line.trim().split(":");
      return candidate === suffix && Number(count) > 0;
    });
  } catch {
    console.warn("pwned_password_check_unavailable", { status: "network" });
    return false;
  }
}
