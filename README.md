# Emlak Platformu

Son güncelleme: 31 Ekim 2026. Envanter mevcut kaynak koddan doğrulanmıştır; canlı dağıtım doğrulaması değildir.

Emlakçılar için WhatsApp ilan akışı ve insan eliyle hazırlanan reklam videosu sipariş platformu.

## Mevcut özellikler

- WhatsApp hesabını QR ile bağlama ve ilan alınacak grupları seçme.
- Gemini ile ilan ayrıştırma, kalite puanı, mükerrer kontrolü ve admin onayı.
- Filtreli ilan akışı, kişisel ilan kapsamı, abonelik günlük limitleri ve deneme hesabı.
- Okunmamış ilan sayacı ve web push bildirimleri.
- Fotoğraftan video, ham video düzenleme veya yerinde çekim siparişi; dosya yükleme, teklif, ödeme ve özel teslim.
- Giriş/kayıt, rol yönlendirmesi, şifre yenileme ve abonelik yönetimi.

## Dizinler

| Dizin | Görev |
|---|---|
| web/ | Next.js 16, React 19, TypeScript arayüzü; API ve cron rotaları |
| scraper/ | Python worker, Gemini, kalite kontrolü ve Supabase yazımı |
| scraper/sidecar/ | Baileys WhatsApp köprüsü ve kişisel oturumlar |
| supabase/migrations/ | Şema, RLS, RPC ve Storage; 0001–0024 değişiklikleri |
| docs/ | Mimari ve ekip akışı |
| obss_project/artifacts/ | Tarihli plan, test ve tasarım kayıtları |

## Yerel kurulum

Node.js/npm, Python, Supabase projesi ve servis anahtarları gerekir. Komutlar Windows PowerShell içindir.

Kökte `Copy-Item .env.example .env` ile ayar dosyasını oluşturup doldurun. Gerçek anahtarları repoya eklemeyin. Supabase CLI ile `supabase link --project-ref <proje-ref>` kullanarak projeyi bağlayın. Migration uygulamadan önce dosya listesini inceleyin: aynı klasördeki `*.down.sql` dosyaları geri alma içindir; ileri migration olarak çalıştırılmamalıdır. Dağıtım aracının bunları ayırt ettiğini doğrulayın.

### Web

```powershell
cd web
npm ci
Copy-Item ../.env.example .env.local
npm run dev
```

Yerel adres: http://localhost:3000. En az `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` ve ayrıcalıklı sunucu işlemleri için `SUPABASE_SERVICE_ROLE_KEY` ayarlanmalıdır. Site adresi `NEXT_PUBLIC_SITE_URL` ile belirlenir.

### Python worker

Ayrı terminalde:

```powershell
cd scraper
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m dotenv -f ../.env run -- python orchestrator.py
```

Worker .env dosyasını kendiliğinden yüklemez; yukarıdaki komut değişkenleri sürece aktarır. Varsayılan adres `127.0.0.1:8090`; `BAILEYS_WEBHOOK_SECRET` zorunludur.

### WhatsApp sidecar

Başka terminalde:

```powershell
cd scraper/sidecar
npm ci
node --env-file=../../.env bridge.js
```

Node.js'in `--env-file` desteği gerekir. Ortak hesap terminal QR'ı kullanır; kişisel hesaplar `/agent/whatsapp` üzerinden bağlanır.

## Özellik ayarları

| Özellik | Ayarlar |
|---|---|
| Kişisel WhatsApp | Web: NEXT_PUBLIC_WA_LINK_ENABLED=1. Sidecar: WA_MULTI_SESSION=1, WA_AUTH_KEY, Supabase ayarları; isteğe bağlı WA_AUTH_ROOT / WA_MAX_SESSIONS |
| Gemini | GEMINI_API_KEYS; virgülle ayrılmış anahtar rotasyonu |
| Ödeme | IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_BASE_URL, IYZICO_WEBHOOK_SECRET |
| Push | VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY |
| Cron | CRON_SECRET; programlar web/vercel.json içinde |

Kişisel webhook yolu loopback gerektirir; worker ve sidecar aynı makinede çalışmalıdır. WA_AUTH_KEY için `openssl rand -hex 32`, VAPID anahtarları için `npx web-push generate-vapid-keys` kullanılabilir. Özel anahtarlar yalnız sunucuda tutulmalıdır.

Destek numarası **+90 531 840 77 44**, [WhatsApp](https://wa.me/905318407744). Merkezi kaynak: `web/src/lib/contact.ts`.

Tüm değişkenler için [.env.example](.env.example).

## Kontroller

```powershell
# web/ içinde
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build

# scraper/ içinde
.\.venv\Scripts\python.exe -m pytest tests -q

# scraper/sidecar/ içinde
npm test
```

31 Ekim 2026 yerel inceleme kaydı: web **1.073 başarılı**, Python **155 başarılı / 11 atlandı**, sidecar **139 başarılı / 1 atlandı**; TypeScript hatasız, ESLint **0 hata / 5 uyarı**. Bunlar inceleme anının sonuçlarıdır. Production build, tarayıcı görsel kontrolü ve canlı servis entegrasyonları bu incelemede çalıştırılmadı.

## Bilinen sınırlar

- Scraper kuyruğu bellekte ve sınırsız; süreç kapanınca bekleyen işler kaybolabilir.
- Checkout hız sınırı süreç bazlıdır; birden çok instance arasında ortak değildir.
- Fotoğraf başına 20 MiB, ham video başına 50 MiB; siparişte en az 3/en fazla 30 fotoğraf veya en fazla 5 ham video.
- Fiyat ve ticari metinler yayından önce ayrıca gözden geçirilmelidir.
- Yerel testler canlı ödeme, WhatsApp, push, RLS ve Storage davranışlarının uçtan uca kanıtı değildir.

[Mimari](docs/ARCHITECTURE.md) · [Ekip akışı](docs/WORKFLOW.md) · [Devir notu](HANDOFF.md)

