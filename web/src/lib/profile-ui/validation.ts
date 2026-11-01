import { FIELD_TEXT, isEmail } from "@/lib/auth-ui/messages";
import { checkPassword } from "@/lib/auth-ui/password-strength";

import type { CompanyInput } from "./types";

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

const between = (v: string, min: number, max: number) => v.trim().length >= min && v.trim().length <= max;

export function validateCompany(i: CompanyInput) {
  const errors: Partial<Record<keyof CompanyInput, string>> = {};
  if (!between(i.companyName, 2, 100)) errors.companyName = FIELD_TEXT.companyName;
  if (!between(i.contactName, 2, 80)) errors.contactName = "Yetkili adını girin (2-80 karakter).";
  if (!i.city.trim()) errors.city = "Şehir seçin.";
  return errors;
}

export function validateEmailChange(next: string, current: string): string | undefined {
  if (!isEmail(next)) return FIELD_TEXT.email;
  if (next.trim().toLowerCase() === current.trim().toLowerCase()) return "Yeni adres mevcut adresinizle aynı.";
}

export function validatePasswordChange(i: { current: string; next: string; confirm: string }) {
  const errors: Partial<Record<"current" | "next" | "confirm", string>> = {};
  if (!i.current) errors.current = "Mevcut şifrenizi girin.";
  if (!checkPassword(i.next).acceptable) errors.next = FIELD_TEXT.weakPassword;
  else if (i.next === i.current) errors.next = "Yeni şifre mevcut şifreden farklı olmalı.";
  if (i.confirm !== i.next) errors.confirm = "Şifreler eşleşmiyor.";
  return errors;
}

export function validateLogo(file: { type: string; size: number }): string | undefined {
  if (!LOGO_TYPES.includes(file.type)) return "Logo PNG, JPG veya WEBP olmalı.";
  if (file.size > LOGO_MAX_BYTES) return "Logo en fazla 2 MB olabilir.";
}
