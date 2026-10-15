# Emlak Platformu (geçici repo adı)

İki modüllü sistem:

1. **İlan agregasyonu** (`scraper/`) — WhatsApp emlak gruplarını dinler, Gemini ile
   yapılandırılmış veriye çevirir, kural-bazlı quality gate'den geçirir ve
   `raw_listings` tablosuna yazar. Admin onayından geçen ilanlar emlakçılara
   abonelik bazlı sunulur.
2. **Video yayın** (`web/`) — Editörün bitirdiği property videoları Next.js
   üzerinden yayınlanır. Otomatik kurgu YOK; bu modül sadece yayın/CMS katmanı.

Mimari detayları ve faz planı için bkz. proje notları (plan dosyası).

## Kurulum

### 1. Supabase

```bash
supabase link --project-ref <proje-ref>
supabase db push
```

`supabase/migrations/0001_init.sql` — tablolar + RLS politikaları.

### 2. Scraper (Python)

```bash
cd scraper
python -m venv .venv && source .venv/Scripts/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env   # doldurup proje köküne koy
python orchestrator.py
```

### 3. WhatsApp sidecar (Node.js)

```bash
cd scraper/sidecar
npm install
node bridge.js   # ilk çalıştırmada QR kodu terminalde çıkar
```

### 4. Web (Next.js)

```bash
cd web
npm install
cp ../.env.example .env.local   # NEXT_PUBLIC_* değerlerini doldur
npm run dev
```

## Çevre değişkenleri

Bkz. [`.env.example`](.env.example).
