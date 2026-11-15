import type { NextConfig } from "next";

// Güvenlik yanıt başlıkları (GUVENLIK_DAYANIKLILIK_TARAMA_RAPORU bulgu 3).
// Çalışma-zamanı harici kaynaklar: Supabase (auth/REST/storage), Unsplash görselleri.
// iyzico ödemesi ayrı sayfaya YÖNLENDİRMEDİR (fetch/iframe değil), bu yüzden connect/frame'e eklenmez.
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : "";
  } catch {
    return "";
  }
})();

// CSP zorlanır (güvenlik değerlendirmesi 2026-11-15 bulgu 6). Teslim edilen ilan videoları
// Supabase imzalı URL'sinden oynatıldığı için media-src Supabase'i içerir.
const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Next.js satır içi bootstrap script'leri nonce olmadan 'unsafe-inline' ister; 'unsafe-eval' yalnız dev (turbopack HMR).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://images.unsplash.com ${supabaseOrigin}`.trim(),
  `media-src 'self' blob: ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  // dev: HMR websocket'i (ws://localhost) için ws: gerekir; production'da yok.
  `connect-src 'self' ${supabaseOrigin}${isDev ? " ws:" : ""}`.trim(),
  "frame-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    agentUpgrade: "security",
    serverActions: {
      bodySizeLimit: "55mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
