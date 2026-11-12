# Emlak Platformu — Web

Next.js 16 + React 19 + TypeScript. Son güncelleme: 31 Ekim 2026.

## Başlatma

```powershell
npm ci
Copy-Item ../.env.example .env.local
npm run dev
```

Supabase ve ilgili özellik ayarlarını .env.local içinde doldurun. Yerel adres: http://localhost:3000.

## Ekranlar

- Genel: /, /pricing, /login, /signup, /sifremi-unuttum, /sifre-yenile.
- Bilgilendirme: /kvkk, /gizlilik, /kullanim-sartlari.
- Emlakçı: /agent/dashboard, /agent/whatsapp, /agent/videos, /agent/videos/new, /agent/videos/[id].
- Hesap: /account/subscription.
- Admin: /admin/listings, /admin/videos, /admin/videos/[id].

WhatsApp sayfası için NEXT_PUBLIC_WA_LINK_ENABLED dolu olmalıdır. Kaynak dizindeki (marketing) route grubu URL'nin parçası değildir.

## Kontroller

```powershell
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

31 Ekim incelemesinde 82 dosyada 1.073 test geçti; TypeScript hatasız, ESLint 5 uyarı verdi. Build ve canlı entegrasyonlar bu incelemede çalıştırılmadı.

Destek: **+90 531 840 77 44**, [WhatsApp](https://wa.me/905318407744). Tek kaynak: src/lib/contact.ts.

Ayrıntılı kurulum: [kök README](../README.md). Veri akışı: [mimari](../docs/ARCHITECTURE.md). Kod değişikliklerinde [AGENTS.md](AGENTS.md) talimatlarını izleyin.

