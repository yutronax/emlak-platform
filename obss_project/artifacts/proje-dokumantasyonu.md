# Emlak Platform — Teknik Dokümantasyon

> Kaynak: kod tabanının tamamı okunarak üretildi (2026-10-17). Git: `66b78ed` (HEAD, main) + commit edilmemiş ödeme/abonelik çalışması (`0003_subscriptions_payment.sql`, `web/src/app/{account,api,pricing}`, `web/src/lib/payments/`, `web/src/test/`, `web/vitest.config.ts`).
> Her iddianın yanında dosya yolu verilmiştir. "Doğrulanmadı" ifadesi, canlı sistem kontrol edilmeden yalnızca koda/rapora dayanıldığını belirtir.

---

## 1. Ürün Özeti

İki modüllü bir B2B emlak platformu (`README.md`):

1. **İlan agregasyonu** — WhatsApp emlak gruplarındaki mesajlar dinlenir (Baileys sidecar), Gemini ile yapılandırılmış ilana çevrilir, kural-bazlı kalite skoru + fingerprint dedup'tan geçirilip `raw_listings` tablosuna yazılır. Admin onayından geçen ilanlar `listings` tablosuna taşınır ve **aktif/trialing aboneliği olan emlakçılara** RLS ile açılır (`supabase/migrations/0001_init.sql` → `listings_subscriber_select`).
2. **Video yayın** — Editörün kurguladığı mülk videolarının (`properties`, `property_videos`) yayınlanması. Otomatik kurgu yok; sadece CMS/yayın katmanı. **Henüz kodlanmadı** (Faz 5, `web/src/app/admin/videos/page.tsx` placeholder).
3. **Abonelik/ödeme (Faz 4, commit edilmemiş)** — Plan kataloğu (`plans`), iyzico checkout, webhook ile abonelik aktivasyonu.

**Roller (koddaki karşılıkları):**
| Rol | Kodda nasıl temsil ediliyor | Erişebildiği yerler |
|---|---|---|
| Admin | `agents.is_admin = true` (`0002_admin_review.sql`) | `/admin/*` (layout kontrolü), `raw_listings` select/update, `listings` insert/select, `approve_raw_listing` / `reject_raw_listing` RPC |
| Emlakçı (agent, abone) | `agents.id = auth.users.id` (`0001_init.sql`) | Kendi `agents` satırı, kendi `subscriptions`, aktif abonelikle `listings`, kendi `properties`/`property_videos`; `/agent/dashboard`, `/pricing`, `/account/subscription`, `/api/subscriptions/*` |
| Son kullanıcı / anonim ziyaretçi | Ayrı rol yok | Sadece `/` (placeholder) ve `/login`. Public video galerisi için anon policy "Faz 5'te eklenecek" (`0001_init.sql` yorum satırı 134) |
| Servis hesapları | `SUPABASE_SERVICE_ROLE_KEY` | Scraper (`scraper/supabase_client.py`), web'de webhook + checkout insert (`web/src/lib/supabase/server.ts::createServiceRoleClient`) |

Ekip yapısı (`docs/WORKFLOW.md`): 2 yazılımcı (scraper/backend, web/frontend), 1 editör, 1 kameraman.

---

## 2. Mimari Genel Bakış

**Bileşenler:**
| Bileşen | Teknoloji | Konum | Çalışma şekli |
|---|---|---|---|
| WhatsApp sidecar | Node.js, `@whiskeysockets/baileys ^7.0.0-rc14`, `pino`, `qrcode-terminal` | `scraper/sidecar/bridge.js` | WhatsApp Web oturumu (QR), `messages.upsert` → HTTP POST |
| Scraper orchestrator | Python, `google-genai`, `supabase`, `python-dotenv` (`scraper/requirements.txt`) | `scraper/orchestrator.py` | `http.server` `:8090/baileys-webhook`, `Queue` + `ThreadPoolExecutor(max_workers=10)` |
| Parser | Gemini `gemini-2.5-flash` | `scraper/parser.py` | Tek LLM çağrısı, JSON şema çıkarımı |
| Key rotasyonu | — | `scraper/api_key_manager.py::GeminiKeyManager` | `GEMINI_API_KEYS` virgüllü liste, 429'da 61 sn cooldown |
| Quality gate | Kural-bazlı | `scraper/quality_gate.py` | 0–1 skor + issue listesi |
| Dedup | SHA-256 | `scraper/fingerprint.py::compute_fingerprint` | city+district+rooms+price+area_m2 |
| Veritabanı | Supabase Postgres + Auth + RLS | `supabase/migrations/0001..0003` | Proje ref `bbjmjzixcugdwbcwydux` (`.mcp.json`, `obss_project/artifacts/supabase-proje-kurulumu/verify_report.md`) |
| Web | Next.js 16.4.0, React 19.3.0, Tailwind v4, `@supabase/ssr` (`web/package.json`) | `web/src/` | App Router, Server Components, Server Actions, Route Handlers; `web/src/proxy.ts` session tazeleme (Next 16 middleware karşılığı) |
| Ödeme | iyzico (Checkout Form API, HMAC webhook) | `web/src/lib/payments/iyzico.ts` | Sadece `fetch`, SDK yok |

**Veri akışı (metin diyagram):**
```
WhatsApp grubu
  └─(Baileys WS)─> bridge.js  ──POST {id,text,group}──> orchestrator.py :8090/baileys-webhook
                                                          │ _active_ids set (bellek-içi dedup)
                                                          ▼ Queue → ThreadPool(10) → handle_message
                                    parser.parse_listing_message (Gemini) → None ise atla
                                    fingerprint.compute_fingerprint → supabase_client.fingerprint_exists ise atla
                                    quality_gate.score_listing
                                    supabase_client.insert_raw_listing  ──service-role──> raw_listings(status='pending')
Admin (tarayıcı) → /admin/listings (RLS: is_admin) ──Server Action──> rpc approve_raw_listing → listings INSERT + raw_listings 'approved'
                                                                  └─> rpc reject_raw_listing  → raw_listings 'rejected'
Emlakçı → /pricing → BuyButton → POST /api/subscriptions/checkout → subscriptions INSERT 'pending' (service-role)
                                                                  → iyzico checkoutform/initialize → checkout_url → yönlendirme
iyzico → POST /api/webhooks/payment (HMAC x-iyzico-signature) → payment_events INSERT → subscriptions UPDATE active/failed
Emlakçı → /agent/dashboard (sadece abonelik rozeti; listings okunmuyor)  /account/subscription (abonelik detayı)
```

**Env değişkenleri:** `.env.example`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEYS`, `BAILEYS_WEBHOOK_PORT=8090`, `WHATSAPP_SESSION_DIR`, `AUTO_SUBMIT=false`, `QUALITY_GATE_THRESHOLD=0.5`. Kodda kullanılıp `.env.example`'da **olmayan**: `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL`, `IYZICO_WEBHOOK_SECRET` (`web/src/lib/payments/iyzico.ts`), `WEBHOOK_URL` (`bridge.js`), `GEMINI_API_KEY` (tekil fallback, `api_key_manager.py`).

---

## 3. Veri Modeli

8 tablo, 1 enum, 2 RPC fonksiyonu. RLS 8 tablonun hepsinde açık.

### Enum `subscription_status`
- `0001_init.sql`: `trialing`, `active`, `past_due`, `canceled`
- `0003_subscriptions_payment.sql`: `+ pending`, `+ failed`, `+ needs_review`

### `agents` — `0001_init.sql` (+`0002`)
| Kolon | Tip | Not |
|---|---|---|
| id | uuid PK | FK → `auth.users(id)` ON DELETE CASCADE |
| company_name | text NOT NULL | |
| phone | text | |
| created_at | timestamptz NOT NULL default now() | |
| is_admin | boolean NOT NULL default false | `0002_admin_review.sql` |

RLS: `agents_self_select` (select, `id = auth.uid()`), `agents_self_update` (update, `id = auth.uid()`). **INSERT policy yok**; uygulamada agents satırı oluşturan kod da yok. `agents_self_update` bir `WITH CHECK`/kolon kısıtı içermiyor (bkz. §10).

### `subscriptions` — `0001_init.sql` (+`0003`)
| Kolon | Tip | Not |
|---|---|---|
| id | uuid PK default gen_random_uuid() | |
| agent_id | uuid NOT NULL | FK → `agents(id)` ON DELETE CASCADE; index `subscriptions_agent_id_idx` |
| plan | text (0003'te NOT NULL kaldırıldı) | Deprecated (comment) |
| status | subscription_status NOT NULL default 'trialing' | |
| current_period_end | timestamptz (0003'te NOT NULL kaldırıldı) | |
| created_at | timestamptz NOT NULL default now() | |
| plan_id | uuid | FK → `plans(id)` (0003) |
| provider_subscription_id | text | 0003, kodda hiç yazılmıyor |
| provider_customer_id | text | 0003, kodda hiç yazılmıyor |

Index: `subscriptions_one_open_per_agent_idx` UNIQUE (agent_id) WHERE `status::text in ('pending','active')` (0003).
RLS: `subscriptions_self_select` (select, `agent_id = auth.uid()`). Insert/update policy yok → yazma sadece service-role.

### `raw_listings` — `0001_init.sql`
| Kolon | Tip | Not |
|---|---|---|
| id | uuid PK | |
| source | text NOT NULL | 'whatsapp' |
| source_group | text | WhatsApp `remoteJid` |
| source_message_id | text | |
| raw_text | text NOT NULL | |
| parsed | jsonb NOT NULL | Gemini çıktısı |
| fingerprint | text NOT NULL | index `raw_listings_fingerprint_idx` (unique değil) |
| quality_score | numeric(3,2) | |
| status | text NOT NULL default 'pending' CHECK in ('pending','approved','rejected') | index `raw_listings_status_idx` |
| reviewed_by | uuid | FK → `agents(id)` |
| reviewed_at | timestamptz | |
| created_at | timestamptz | |

Unique partial index: `raw_listings_source_message_idx` (source, source_message_id) WHERE source_message_id IS NOT NULL.
RLS: 0001'de policy yok (sadece service-role). 0002: `raw_listings_admin_select`, `raw_listings_admin_update` (admin EXISTS kontrolü).

### `listings` — `0001_init.sql`
Kolonlar: id uuid PK, raw_listing_id uuid FK → `raw_listings(id)`, title text NOT NULL, price numeric, currency text NOT NULL default 'TRY', rooms text, area_m2 numeric, city, district, neighborhood, description text, created_at. Index `listings_city_district_idx`.
RLS: `listings_subscriber_select` (subscriptions'ta `status in ('active','trialing') and current_period_end > now()` olan), `listings_admin_insert`, `listings_admin_select` (0002). Update/delete policy yok.

### `properties` — `0001_init.sql`
id uuid PK, agent_id uuid NOT NULL FK → agents CASCADE, title text NOT NULL, address text, created_at. Index `properties_agent_id_idx`.
RLS: `properties_owner_select/insert/update` (`agent_id = auth.uid()`). Delete policy yok. **Hiçbir uygulama kodu bu tabloyu kullanmıyor.**

### `property_videos` — `0001_init.sql`
id uuid PK, property_id uuid NOT NULL FK → properties CASCADE, storage_path text NOT NULL, status text CHECK ('draft','published') default 'draft', published_at, created_at. Index `property_videos_property_id_idx`.
RLS: `property_videos_owner_select`, `property_videos_owner_insert` (properties üzerinden sahiplik). Update/delete/anon policy yok. **Kullanılmıyor.**

### `plans` — `0003_subscriptions_payment.sql`
id uuid PK, name text NOT NULL, price_minor_unit integer NOT NULL (kuruş), currency text NOT NULL default 'TRY', max_listings integer, created_at.
RLS: `plans_authenticated_select` (select to authenticated using true). Yazma policy yok. **`sort_order` kolonu YOK** (ama `web/src/app/pricing/page.tsx` bu kolonu select + order ediyor, bkz. §9). Seed verisi (Free/Başlangıç/Pro) hiçbir migration'da yok.

### `payment_events` — `0003_subscriptions_payment.sql`
id uuid PK, subscription_id uuid FK → subscriptions CASCADE, provider_event_id text NOT NULL UNIQUE, event_type text NOT NULL, raw_payload jsonb NOT NULL, created_at. RLS açık, policy yok (service-role only).

### RPC fonksiyonları — `0002_admin_review.sql`
- `approve_raw_listing(p_raw_listing_id uuid) returns uuid` — SECURITY INVOKER, `search_path=public`. Pending raw kaydın `parsed` alanından `listings` satırı üretir (title yoksa `rooms district city` birleşimi), raw'ı `approved` + `reviewed_by=auth.uid()` yapar. Kayıt yok/incelenmiş → `raise exception 'raw_listing bulunamadı...'`.
- `reject_raw_listing(p_raw_listing_id uuid) returns void` — SECURITY INVOKER; pending → `rejected`.
- `revoke all from public; grant execute to authenticated`. Yetki RLS'e dayanıyor.

### Migration uygulama durumu
- 0001, 0002: canlı projeye uygulandı (`obss_project/artifacts/supabase-proje-kurulumu/verify_report.md` gate 3 PASS).
- 0003: verify raporuna göre **canlıya uygulanmamıştı** (`abonelik-plani-odeme-entegrasyonu/verify_report.md` gate 3 FAIL: `plans`/`payment_events` yok, `subscriptions.plan_id` yok). Sonradan uygulanıp uygulanmadığı doğrulanmadı.

---

## 4. Sayfa/Route Envanteri

Toplam **7 sayfa route'u**, **1 layout** (admin), **3 Server Action**, **1 proxy (middleware)**.

| Yol | Dosya | Amaç | Auth | Tablolar | Durum |
|---|---|---|---|---|---|
| `/` | `web/src/app/page.tsx` | Statik karşılama metni; "Faz 5'te gerçek video galerisi" | Yok | — | İskelet |
| `/login` | `web/src/app/login/page.tsx` (client) + `login/actions.ts::login` | E-posta/şifre ile `supabase.auth.signInWithPassword`; başarıda **her zaman** `/admin/listings`'e redirect | Yok | auth.users | Çalışır (kayıt/şifre sıfırlama/çıkış yok) |
| `/admin/*` (layout) | `web/src/app/admin/layout.tsx` | `getUser` yoksa `/login`, `agents.is_admin` false ise `notFound()` | Admin | agents | Tamamlanmış |
| `/admin/listings` | `web/src/app/admin/listings/page.tsx` + `actions.ts::approveListing/rejectListing` | Pending `raw_listings` listesi (raw_text, parsed alanları, skor), Onayla/Reddet formları → RPC + `revalidatePath` | Admin (layout + RLS) | raw_listings, listings (RPC) | Tamamlanmış (MVP; sayfalama/filtre/düzenleme yok, test yok) |
| `/admin/videos` | `web/src/app/admin/videos/page.tsx` | Sadece "Faz 5'te eklenecek" metni | Admin (layout) | — | İskelet |
| `/agent/dashboard` | `web/src/app/agent/dashboard/page.tsx` | Abonelik rozeti (`active`/`past_due`); ilan akışı "Faz 4'te eklenecek" | **Yok** — oturumsuzsa rozet olmadan render olur, redirect yok | subscriptions | İskelet (rozet dışında içerik yok; `listings` okunmuyor) |
| `/pricing` | `web/src/app/pricing/page.tsx` + `buy-button.tsx` | `plans` listesi (fiyat `price_minor_unit/100` ₺), aktif planı işaretler, `BuyButton` → `POST /api/subscriptions/checkout` | Opsiyonel (plans RLS authenticated-only → anonimde boş liste) | plans, subscriptions | Kodlanmış, commit edilmemiş; **`sort_order` hatası nedeniyle canlıda hata verir** (§9) |
| `/account/subscription` | `web/src/app/account/subscription/page.tsx` | Plan adı (`plan:plans(name)` join), durum etiketi, dönem sonu, `past_due` uyarısı | Login zorunlu (`redirect("/login")`) | subscriptions, plans | Kodlanmış, commit edilmemiş |
| (proxy) | `web/src/proxy.ts` | Her istekte `supabase.auth.getUser()` ile session cookie tazeleme; matcher statik dosyalar hariç tümü | Yetki kontrolü YAPMAZ | — | Tamamlanmış |

Server Action'lar: `login` (`login/actions.ts`), `approveListing`, `rejectListing` (`admin/listings/actions.ts`). Action'larda uygulama seviyesinde admin kontrolü yok; yetki RLS + RPC SECURITY INVOKER'a bırakılmış (yorum satırı açıkça belirtiyor).

---

## 5. API Uç Noktaları

Toplam **3 Route Handler** (+3 Server Action §4'te, + scraper'ın 1 HTTP ucu).

### `POST /api/subscriptions/checkout` — `web/src/app/api/subscriptions/checkout/route.ts`
- **Auth:** `supabase.auth.getUser()`; yoksa `401 {"error":"UNAUTHORIZED"}`.
- **Rate limit:** bellek-içi `Map<userId, timestamps>`; 10 sn penceresinde >10 istek → `429 RATE_LIMITED`.
- **Girdi:** `{ plan_id: string }` (diğer alanlar, `price` dahil, yok sayılır — AC-S1).
- **Akış:** `plans` select (yok → `404 PLAN_NOT_FOUND`) → `subscriptions` status='active' kontrolü (var → `409 ALREADY_SUBSCRIBED {current_plan}`) → service-role ile `subscriptions` INSERT `{agent_id, plan_id, status:'pending'}` (23505 → `409`) → `createCheckoutSession(plan.id, userId)`.
- **Çıktı:** `201 {subscription_id, status:"pending", checkout_url, expires_at}`; timeout → `504 PAYMENT_TIMEOUT` (kayıt pending kalır); diğer sağlayıcı hatası → kayıt `failed`'a update + `502 PAYMENT_PROVIDER_ERROR {retryable:true}`; DB hatası → `500 INTERNAL_ERROR`; plan_id eksik → `400 INVALID_INPUT`.
- **Tablolar:** plans (R), subscriptions (R, W-service-role).

### `GET /api/subscriptions/[id]` — `web/src/app/api/subscriptions/[id]/route.ts`
- **Auth:** getUser; yoksa 401.
- **Sahiplik:** `.eq("id", id).eq("agent_id", user.id)` + RLS. Yetkisiz ve yok aynı `404 NOT_FOUND` (AC-S2).
- **Çıktı:** `200 {plan_id, status, current_period_end}`; DB hatası `500`.
- **Tablolar:** subscriptions (R). UI'da bu ucu çağıran kod yok.

### `POST /api/webhooks/payment` — `web/src/app/api/webhooks/payment/route.ts`
- **Auth:** HMAC-SHA256 hex, header `x-iyzico-signature`, secret `IYZICO_WEBHOOK_SECRET`, `timingSafeEqual` (`iyzico.ts::verifyWebhookSignature`). Geçersiz → `401 INVALID_SIGNATURE` (DB'ye dokunmadan).
- **Girdi (beklenen şema):** `{event_id, event_type, subscription_id}`; eksik/bozuk JSON → `400 INVALID_INPUT`.
- **Akış:** service-role ile `payment_events` INSERT (23505 → `200 {received, duplicate:true, event_id}`) → `STATUS_BY_EVENT_TYPE`: `PAYMENT_SUCCESS`→`active` (+`current_period_end = now+30 gün`), `PAYMENT_FAILED`→`failed`; bilinmeyen tip → `200 {received:true}` → `subscriptions` UPDATE by id.
- **Update hatası:** `200 {received, subscription_id, status:"needs_review"}` — ancak DB'de status `needs_review`'a **yazılmıyor**, sadece yanıtta dönüyor; admin uyarısı yok.
- **Tablolar:** payment_events (W), subscriptions (W).

### Scraper HTTP ucu: `POST /baileys-webhook` — `scraper/orchestrator.py::WebhookHandler`
- `0.0.0.0:${BAILEYS_WEBHOOK_PORT|8090}`, auth yok. Girdi `{id, text, group}`; bozuk JSON → 400; diğer path → 404; aksi halde kuyruğa alır, 200.

### Supabase RPC'leri (PostgREST üzerinden)
`approve_raw_listing`, `reject_raw_listing` (§3).

---

## 6. Scraper/Sidecar Akışı

1. **Bağlantı** (`scraper/sidecar/bridge.js::bridge`): `useMultiFileAuthState(WHATSAPP_SESSION_DIR | sidecar/session)`; QR terminale basılır. Kopmada `connectionReplaced` → yeniden bağlanmaz; `loggedOut` → session silinip yeniden QR gerekir; diğer → 2 sn sonra `bridge()` tekrar.
2. **Mesaj yakalama:** `messages.upsert` (yalnız `type === 'notify'`, `fromMe` hariç). `extractText`: conversation / extendedTextMessage / image-video caption; ephemeral/viewOnce sarmalayıcıları açılır. Metinsiz mesaj gönderilmez. **Grup filtresi yok** — DM'ler dahil tüm gelen metin mesajları iletilir. Grup adı zenginleştirme yok (`group` = `remoteJid`).
3. **POST** `WEBHOOK_URL` (default `http://localhost:8090/baileys-webhook`), body `{id, text, group}`; hata sadece console log, retry yok.
4. **Kabul** (`orchestrator.py::WebhookHandler.do_POST`): `_active_ids` setinde varsa 200 ile düşürür, yoksa ekler ve `message_queue`'ya koyar.
5. **İşleme** (`_background_worker_loop` → `ThreadPoolExecutor(10)` → `handle_message`):
   a. `parse_listing_message` (`parser.py`): Gemini `gemini-2.5-flash`, `SYSTEM_PROMPT` ile şema `{is_listing,title,price,currency,rooms,area_m2,city,district,neighborhood,description}`; regex ile ilk `{...}` JSON; `is_listing` false/parse hatası → None (atlanır). 429/RESOURCE_EXHAUSTED → `switch_to_next_async`, key sayısı kadar deneme.
   b. `compute_fingerprint` → `fingerprint_exists` (raw_listings'te aynı fingerprint varsa atla — check-then-insert, unique değil).
   c. `score_listing` (`quality_gate.py`): başlangıç 1.0; fiyat yok −0.1, fiyat ≤0 veya >500M −0.4, oda formatı `^\d+\+\d+...` değil −0.1, m² ≤0 veya >10.000 −0.2, şehir yok −0.3.
   d. `insert_raw_listing` service-role ile `status:'pending'`. `is_safe_to_auto_approve(score, QUALITY_GATE_THRESHOLD)` **sadece loglanıyor**; otomatik onay yok, `AUTO_SUBMIT` env'i kodda okunmuyor.
   e. `finally`: `_active_ids.discard(message_id)` — set yalnızca işlem sürerken korur.
6. **Admin onayı:** `/admin/listings` → `approveListing` → `rpc('approve_raw_listing')` → `listings` INSERT + raw `approved`; ya da `rejectListing` → `rejected`.
7. **Tüketim:** RLS `listings_subscriber_select` hazır, ama `listings`'i okuyan bir web sayfası **yok**.

Doğrulama aracı: `scraper/scripts/verify_supabase.py` — şema smoke (6 tablo + `agents.is_admin` + 2 RPC; **0003 tabloları `REQUIRED_TABLES`'ta yok**), service-role yaz-oku-sil (raw_listings), anon insert RLS reddi.

---

## 7. Ödeme/Abonelik Akışı

**Sağlayıcı:** iyzico (`web/src/lib/payments/iyzico.ts`). `obss_project/artifacts/abonelik-plani-odeme-entegrasyonu/atdd.md` bunu "NİHAİ DEĞİL, ekip onayı bekleyen Assumption" olarak işaretliyor (GitHub Issue #5, Jira EML-5).

**Adımlar:**
1. `/pricing` → `plans` listesi → `BuyButton` (`buy-button.tsx`) `POST /api/subscriptions/checkout {plan_id}`. Yanıt 201 ise `window.location.href = checkout_url`; 401/409/429/diğer için Türkçe mesaj.
2. Checkout route: auth → rate limit → plan → aktif abonelik kontrolü → `subscriptions` pending INSERT (service-role) → `createCheckoutSession`.
3. `createCheckoutSession(planId, agentId)`: plan fiyatını tekrar okur (user-scoped client), body `{locale:'tr', conversationId: agentId, price: (minor/100).toFixed(2), currency, basketId: plan.id, paymentGroup:'SUBSCRIPTION'}`; `IYZWS apiKey:sha1-base64(apiKey+rnd+secret+body)` + `x-iyzi-rnd`; POST `${IYZICO_BASE_URL}/payment/iyzipos/checkoutform/initialize/auth/ecom`, 10 sn timeout; `status==='success' && paymentPageUrl` beklenir; `expires_at = now+30 dk` (yerel hesap).
   - Gönderilen body'de `subscription_id`, `callbackUrl`, alıcı (buyer) / sepet kalemleri yok; `conversationId` = agentId.
4. Kullanıcı iyzico sayfasında öder (UI dönüş/callback sayfası yok).
5. iyzico → `POST /api/webhooks/payment` → imza → `payment_events` (idempotency) → `subscriptions.status` active (+30 gün) / failed.

**Durum makinesi (kodda gerçekleşen):**
```
(yok) --checkout--> pending --webhook PAYMENT_SUCCESS--> active (current_period_end=now+30g)
                    pending --webhook PAYMENT_FAILED---> failed
                    pending --sağlayıcı hata (timeout dışı)--> failed
                    pending --timeout--> pending (kalır; reconciliation YOK)
```
Enum'da olup kodda hiç set edilmeyen: `trialing`, `past_due`, `canceled`, `needs_review`. `past_due` sadece UI'da okunuyor (dashboard rozeti, account uyarısı).

**ATDD'de olup kodda olmayanlar:** AC-1'in "ilan limiti güncellenir" kısmı (`plans.max_listings` hiçbir yerde okunmuyor), AC-5 grace period → `free` plana düşüş, reconciliation cron, `needs_review` DB yazımı + admin uyarısı, `PAYMENTS_ENABLED` feature flag, yenileme (recurring) ödemesi, Free plan, ADR kaydı, kart reddinde `reason:"CARD_DECLINED"`.

---

## 8. Test Kapsamı

**Web (Vitest 4, `web/vitest.config.ts`: environment `node`, include `src/**/*.test.{ts,tsx}`, alias `@`):** 6 dosya, 32 test (verify raporu: 32/32 yeşil). Tümü `web/src/test/fake-supabase.ts` sahte istemcisi ve mock `fetch` ile — gerçek Supabase/iyzico'ya dokunmuyor.
| Dosya | Kapsanan |
|---|---|
| `app/api/subscriptions/checkout/route.test.ts` | 201 happy path, 404 plan, 401, 409 aktif, AC-S1 price ignore, AC-S4 rate limit |
| `app/api/subscriptions/[id]/route.test.ts` | 200 sahip, IDOR 404, yetkisiz=yok aynı body, 401, 404 |
| `app/api/webhooks/payment/route.test.ts` | Geçerli imza → active, duplicate event, update hatası → needs_review |
| `lib/payments/iyzico.test.ts` | HMAC doğru/yanlış secret/body değişmiş; checkout isteği fiyat+currency+URL |
| `app/pricing/page.test.tsx` | Plan listesi, plans hata mesajı, aktif planda buton gizli |
| `app/account/subscription/page.test.tsx` | Aktif abonelik, abonelik yok, sorgu hatası, past_due uyarısı |

**Scraper (pytest, `scraper/tests/test_verify_supabase.py` + `conftest.py`):** 37 test fonksiyonu (34 unit + 3 integration, integration'lar env yoksa skip). **Sadece `scripts/verify_supabase.py`'yi test ediyor.**

**Kritik boşluklar:**
- `parser.py`, `quality_gate.py`, `fingerprint.py`, `api_key_manager.py`, `orchestrator.py`, `supabase_client.py`, `bridge.js` — **hiç test yok**.
- `/admin/listings` sayfası, `approveListing`/`rejectListing`, `admin/layout.tsx` yetki kontrolü, `/login`, `/agent/dashboard` — test yok.
- SQL tarafı: `approve_raw_listing`/`reject_raw_listing` RPC'leri ve RLS politikaları için otomatik test yok (sadece anon raw_listings insert reddi).
- Webhook route testinde **geçersiz imza (401) ve `PAYMENT_FAILED` senaryosu route seviyesinde yok** (imza sadece `iyzico.test.ts` unit'inde; verify_report AC-2/AC-S3'ü route testi gibi gösteriyor).
- Checkout: 400 INVALID_INPUT, 502 provider error (+`failed` update), 504 timeout, 23505 yarış — test yok. AC-S5 (ham hata sızıntısı) için açık bir test yok.
- Fake Supabase, `pricing/page.tsx`'in var olmayan `sort_order` kolonunu fark etmiyor → testler yeşilken canlı sayfa bozuk.
- E2E (Playwright) yok; ATDD hedefi %10 e2e + %85 coverage ölçülmüyor (coverage config yok).

---

## 9. Bilinen Eksikler / Yarım Kalan İşler

**Kod hataları / tutarsızlıklar**
1. `web/src/app/pricing/page.tsx` `plans`'tan `sort_order` select + order ediyor; `0003_subscriptions_payment.sql`'de bu kolon yok → PostgREST hatası → sayfa her zaman "Planlar yüklenemedi".
2. `web/src/app/account/subscription/page.tsx` `subscriptions` sorgusunda status filtresi yok + `.maybeSingle()` → aynı agent'ın birden fazla satırı (örn. `failed` + `active`) olduğunda hata → "yüklenemedi" mesajı.
3. Checkout timeout (504) sonrası kayıt `pending` kalıyor; unique index `subscriptions_one_open_per_agent_idx` pending'i de kapsadığı için kullanıcı yeni checkout yapamaz (23505 → 409 "Zaten bu plandasınız") ve reconciliation cron'u yok.
4. Webhook `subscription_id`'yi payload'dan bekliyor, ama `createCheckoutSession` iyzico'ya `subscription_id` göndermiyor (`conversationId = agentId`, `basketId = plan.id`) — sağlayıcı olayının aboneliğe nasıl eşleneceği kodda tanımlı değil.
5. Webhook update hatasında `needs_review` DB'ye yazılmıyor, sadece yanıt gövdesinde.
6. `login` her kullanıcıyı `/admin/listings`'e yönlendiriyor; admin olmayan emlakçı 404 alıyor. Kayıt (signup), `agents` satırı oluşturma, çıkış, şifre sıfırlama yok.
7. `/agent/dashboard` auth guard'sız ve `listings` göstermiyor (ana ürün değeri olan abone ilan akışı yok).
8. `web/src/app/layout.tsx` metadata hâlâ "Create Next App", `lang="en"`.
9. `scraper/scripts/verify_supabase.py::REQUIRED_TABLES` 0003 tablolarını (`plans`, `payment_events`) kontrol etmiyor.
10. `AUTO_SUBMIT` env'i tanımlı ama kullanılmıyor; `is_safe_to_auto_approve` sadece log.

**Yarım fazlar (koddaki "Faz" notları)**
- Faz 4: emlakçı ilan akışı (`agent/dashboard/page.tsx`).
- Faz 5: video yükleme (`admin/videos/page.tsx`), public galeri (`page.tsx`), `property_videos` anon policy (`0001_init.sql` yorum), Supabase Storage bucket'ı (hiç tanımlı değil).
- Kodda `TODO/FIXME` yorumu yok (sadece `.venv` içinde 3. parti).

**atdd.md'de kapanmamış AC'ler — `abonelik-plani-odeme-entegrasyonu`**
- AC-1: ilan limiti güncellemesi yok; uçtan uca canlı doğrulama yok.
- AC-2: kart reddinde `reason` alanı ve kullanıcıya gösterilen sonuç sayfası yok.
- AC-5: grace period / free plana düşüş tamamen yok.
- verify_report: gate 3 (canlı Supabase) FAIL — 0003 uygulanmamış; web'de `SUPABASE_SERVICE_ROLE_KEY` tanımlı değil; security-scan, pm, insan onayı PENDING; e2e N/A.
- Sağlayıcı seçimi (iyzico) ekip onayı bekliyor; ADR yok.
- Rollback beklentisindeki reconciliation cron, `PAYMENTS_ENABLED` flag yok.
- Dosyalar commit edilmemiş (git status `??`).

**`supabase-proje-kurulumu`**: verify gate'leri PASS; `pm` ve insan onayı PENDING. `atdd.md` working tree'de değiştirilmiş (M). `scraper/.env.example`, `web/.env.example`, `supabase/config.toml` atdd'de etkilenen dosya olarak listelenmiş ama repoda yok (sadece kök `.env.example` var).

**Kod ↔ docs çelişkileri**
- `docs/ARCHITECTURE.md`: "`/agent/dashboard` -- select, RLS: subscriber --> listings" diyor; gerçek sayfa `listings` okumuyor, sadece `subscriptions`.
- `docs/ARCHITECTURE.md`: `_active_ids` setinin "Baileys sidecar'da" olduğunu söylüyor; gerçekte `scraper/orchestrator.py`'de.
- `docs/ARCHITECTURE.md` "Faz 1-3" kapsıyor; ödeme akışı (plans, payment_events, iyzico, webhook) dokümanda yok.
- `README.md` kurulumda sadece `0001_init.sql`'den bahsediyor; iyzico env'leri ve `npm test`/vitest anlatılmıyor.
- `atdd.md` (ödeme) "`app/core/deps.py` `get_session`" referansı veriyor — bu projede böyle bir dosya yok (başka projeden kalma metin). Ayrıca `IYZICO_SECRET` diyor; kod `IYZICO_SECRET_KEY` + `IYZICO_WEBHOOK_SECRET` kullanıyor.
- `atdd.md` davranış sözleşmesi `GET /account/subscription → 200 {"subscription":null,"plan":"free"}` JSON ucu tanımlıyor; kodda bu bir HTML sayfası, JSON ucu yok.

---

## 10. Gözlemlenen Riskler

(Sadece kodda doğrudan görülenler.)

1. **`agents_self_update` ile yetki yükseltme** — `0001_init.sql` policy'si `for update using (id = auth.uid())`, kolon kısıtı veya `WITH CHECK` yok; `0002` `is_admin` kolonunu aynı tabloya ekledi. Authenticated bir kullanıcı anon key ile kendi satırında `is_admin=true` UPDATE'i yapabilir görünüyor → admin RLS'lerinin hepsi (`raw_listings`, `listings` insert) açılır. (Canlıda doğrulanmadı; `authz-test` ile prob edilmeli.)
2. **Scraper webhook'u kimlik doğrulamasız ve `0.0.0.0`'a bağlı** (`scraper/orchestrator.py::run`) — ağdan erişen herkes `raw_listings`'e (service-role ile) kayıt sokabilir ve Gemini kotasını tüketebilir.
3. **Webhook payload'ındaki `subscription_id`'ye koşulsuz güven** (`api/webhooks/payment/route.ts`) — imza geçerli olduğu sürece herhangi bir abonelik id'si `active` yapılır; olay tutarı/planı ile kayıt eşleştirilmiyor. Ayrıca `IYZICO_WEBHOOK_SECRET` tanımsızsa tüm webhook'lar 401 (fail-closed, güvenli ama sessiz arıza).
4. **Rate limit bellek-içi** (`checkout/route.ts::recentRequests`) — çok instance/serverless'ta etkisiz; Map hiç temizlenmiyor (kullanıcı başına büyür).
5. **Admin Server Action'larında uygulama seviyesinde yetki kontrolü yok** (`admin/listings/actions.ts`) — tamamen RLS'e bağlı; risk #1 ile birleşince kritik.
6. **Hata mesajı sızıntısı** — `admin/listings/page.tsx` `error.message`'ı UI'a basıyor; `actions.ts` RPC hata metnini `throw new Error` ile iletiyor.
7. **Secret yönetimi** — `SUPABASE_SERVICE_ROLE_KEY` web sunucusunda kullanılıyor (`createServiceRoleClient`), sadece server dosyalarında import ediliyor (doğru). `scraper/.env` diskte var, `.gitignore` (`.env`) ile hariç (doğrulandı: `git check-ignore`). `.mcp.json` (untracked) proje ref'ini içeriyor — secret değil ama commit'lenirse proje kimliği açığa çıkar. iyzico env'leri `.env.example`'da yok → yanlış yapılandırma riski (`IYZICO_BASE_URL` tanımsızsa `undefined/payment/...` URL'ine istek).
8. **Sidecar tüm gelen mesajları iletiyor** (`bridge.js`, grup filtresi yok) — özel/DM mesaj metinleri Gemini'ye gönderilip `raw_listings.raw_text`'e yazılabilir (kişisel veri).
9. **Fingerprint dedup yarışı** — `fingerprint_exists` + insert check-then-act, `fingerprint` unique değil; 10 paralel worker aynı ilanı iki kez yazabilir.
10. **`/agent/dashboard` auth guard'ı yok** — veri sızıntısı yok (RLS), ama oturumsuz erişimde sayfa render ediliyor.
