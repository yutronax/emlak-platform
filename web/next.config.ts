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

// CSP önce Report-Only: ihlaller konsola düşer, sayfa KIRILMAZ (rapor önerisi).
// Enforced hale getirmeden önce gerçek trafikte gözlemlenmeli.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Next.js satır içi bootstrap script'leri nonce olmadan 'unsafe-inline' ister; turbopack dev 'unsafe-eval'.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://images.unsplash.com ${supabaseOrigin}`.trim(),
  "media-src 'self' blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}`.trim(),
  "frame-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy-Report-Only", value: csp },
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
