import type { AuthErrorCode, AuthResult } from "./types";

const ERROR_TEXT: Record<AuthErrorCode, string> = {
  invalid_credentials: "E-posta veya şifre hatalı.",
  rate_limited: "Çok fazla deneme. Biraz sonra tekrar deneyin.",
  oauth_cancelled: "Google ile giriş iptal edildi.",
  network: "Bağlantı sorunu, tekrar deneyin.",
  unknown: "Bir sorun oluştu, tekrar deneyin.",
};

export const FIELD_TEXT = {
  email: "Geçerli bir e-posta girin.",
  password: "Şifrenizi girin.",
  weakPassword: "Daha güçlü bir şifre seçin.",
  companyName: "Şirket adını girin (2-100 karakter).",
  phone: "Geçerli bir cep telefonu girin (5xx xxx xx xx).",
  terms: "Devam etmek için şartları kabul etmeniz gerekiyor.",
} as const;

export function errorText(result: Extract<AuthResult, { status: "error" }>): string {
  return result.message ?? ERROR_TEXT[result.code];
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
