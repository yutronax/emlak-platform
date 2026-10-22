# Emlak Platform — İş Listesi, Sayfa Envanteri ve Olmazsa Olmazlar

> Kaynak: `obss_project/artifacts/proje-dokumantasyonu.md` (2026-10-17, Opus ile çıkarıldı). Her madde o dokümandaki bir bulguya dayanır.

---

## 1. İş Listesi (Backlog) — Önceliklendirilmiş

### P0 — Kritik (canlıda kırık veya güvenlik açığı)
| # | İş | Neden | Dosya |
|---|---|---|---|
| 1 | `agents_self_update` RLS policy'sine kolon kısıtı / `WITH CHECK` ekle (kullanıcı kendi `is_admin`'ini yükseltemesin) | Yetki yükseltme açığı | `supabase/migrations/0001_init.sql`, yeni migration |
| 2 | `plans` tablosuna `sort_order` kolonu ekle (veya sayfadan select/order kaldır) | `/pricing` canlıda sürekli "Planlar yüklenemedi" veriyor | `web/src/app/pricing/page.tsx`, migration |
| 3 | Scraper webhook'una (`:8090/baileys-webhook`) auth/secret ekle, `0.0.0.0` yerine bağlanma adresini sınırla | Auth'suz uç, ağdan erişilip DB/Gemini kotası istismar edilebilir | `scraper/orchestrator.py` |
| 4 | `0003_subscriptions_payment.sql` migration'ının canlıya uygulandığını doğrula/uygula | verify_report'a göre FAIL geçmiş, doğrulanmamış | `supabase/migrations/0003_subscriptions_payment.sql` |
| 5 | Webhook `subscription_id` eşleşmesini doğrula (sağlayıcı olayı ↔ DB kaydı), körü körüne güvenme | İmza geçerliyse herhangi bir id `active` yapılabiliyor | `web/src/app/api/webhooks/payment/route.ts` |

### P1 — Yüksek (ana ürün değeri eksik / yarım akış)
| # | İş | Neden | Dosya |
|---|---|---|---|
| 6 | `/agent/dashboard`'a auth guard ekle | Oturumsuz erişimde sayfa render oluyor | `web/src/app/agent/dashboard/page.tsx` |
| 7 | `/agent/dashboard`'a abone ilan akışını (listings) bağla | Ana ürün değeri — RLS hazır ama hiçbir sayfa `listings` okumuyor | `web/src/app/agent/dashboard/page.tsx` |
| 8 | Admin Server Action'larına (`approveListing`/`rejectListing`) uygulama seviyesi admin kontrolü ekle | Şu an tamamen RLS'e bağlı, risk #1 ile birleşince kritik | `web/src/app/admin/listings/actions.ts` |
| 9 | `account/subscription` sorgusuna status filtresi ekle (`.maybeSingle()` çoklu satırda patlıyor) | Birden fazla subscription satırı (failed+active) varsa hata | `web/src/app/account/subscription/page.tsx` |
| 10 | Checkout timeout sonrası reconciliation (cron/job) ekle | Kayıt `pending` kalıyor, kullanıcı tekrar satın alamıyor | yeni: `web/src/lib/payments/` |
| 11 | Webhook update hatasında `needs_review` durumunu gerçekten DB'ye yaz + admin uyarısı | Şu an sadece response body'de dönüyor, DB'de iz kalmıyor | `web/src/app/api/webhooks/payment/route.ts` |
| 12 | Kayıt (signup) + `agents` satırı oluşturma akışı | `agents` tablosuna INSERT policy yok, oluşturan kod da yok | yeni: `web/src/app/signup/` |
| 13 | `login` sonrası role-aware redirect (admin→/admin, emlakçı→/agent/dashboard) | Şu an herkes `/admin/listings`'e yönleniyor, admin değilse 404 | `web/src/app/login/actions.ts` |

### P2 — Orta (sağlamlaştırma / eksik test)
| # | İş | Neden | Dosya |
|---|---|---|---|
| 14 | `parser.py`, `quality_gate.py`, `fingerprint.py`, `orchestrator.py`, `bridge.js` için birim test yaz | Hiç test yok | `scraper/tests/` |
| 15 | `/admin/listings`, `/login`, `admin/layout.tsx` yetki kontrolü için test yaz | Test yok | `web/src/test/` |
| 16 | ~~Checkout route: 400/502/504/23505 senaryoları için test ekle~~ — **tamamlandı: EML-57** | Test yok | `web/src/app/api/subscriptions/checkout/route.test.ts` |
| 17 | ~~Webhook route testine geçersiz imza (401) ve `PAYMENT_FAILED` senaryosu ekle~~ — **tamamlandı: EML-57** (401 zaten vardı, sadece PAYMENT_FAILED eklendi) | Şu an sadece unit (iyzico.test.ts) seviyesinde | `web/src/app/api/webhooks/payment/route.test.ts` |
| 18 | ~~Fingerprint'i unique index yap veya insert'i atomik hale getir~~ — **tamamlandı: EML-54** | Paralel worker'lar aynı ilanı iki kez yazabiliyor | `supabase/migrations/`, `scraper/supabase_client.py` |
| 19 | Sidecar'a grup filtresi ekle (DM'leri iletme) — **işleniyor: EML-51** | Kişisel veri Gemini'ye ve `raw_listings`'e sızabiliyor | `scraper/sidecar/bridge.js` |
| 20 | ~~`scripts/verify_supabase.py::REQUIRED_TABLES`'a `plans`/`payment_events` ekle~~ — **tamamlandı** | 0003 tabloları kontrol edilmiyor | `scraper/scripts/verify_supabase.py` |
| 21 | ~~`.env.example`'a iyzico + `WEBHOOK_URL` değişkenlerini ekle~~ — **tamamlandı** | Yanlış yapılandırma riski | `.env.example` |
| 22 | `docs/ARCHITECTURE.md`'yi gerçek koda göre güncelle (agent/dashboard, ödeme akışı eksik) | Kod↔doc çelişkisi | `docs/ARCHITECTURE.md` |
| 23 | `raw_listings`'e EML-51 düzeltmesinden ÖNCE sızmış olabilecek geçmiş DM (PII) kayıtlarının tespiti + temizliği (silme/anonimleştirme) — **karar gerçek kullanıcıya sorulmalı, customer mode bu kararı veremez** | EML-51 sadece yeni sızıntıyı durduruyor, geçmiş veriyi temizlemiyor | `raw_listings` tablosu (Supabase) |
| 24 | `web/src/test/fake-supabase.ts`'deki `FakeQuery.execute()`'in `single()`/`maybeSingle()` modu, insert'teki 23505 (duplicate) hatasını `PGRST116`("satır yok") ile EZİYOR — `result.data===null` olan her durumu (hem "hiç satır yok" hem "duplicate hatası") aynı şekilde ele alıyor. EML-57'de keşfedildi, bir testte workaround'la (doğrudan `createServiceRoleClient` stub'lanarak) aşıldı ama kök neden düzeltilmedi — başka testler de aynı tuzağa düşebilir | Test altyapısı hatası, `.insert().select().single()` zinciriyle 23505 simüle etmeye çalışan HER test etkilenir | `web/src/test/fake-supabase.ts` |
| 25 | `webhooks/payment/route.test.ts`'e, `parsePaymentEvent`'in iki farklı hata mesajını ("Geçersiz istek gövdesi" vs "Eksik olay alanı") ayırt ettiğini doğrulayan test ekle — şu an hiçbir test bu mesaj metnini kontrol etmiyor (refactor sırasında bu ayrımın yanlışlıkla birleştirildiği, testler yeşil kaldığı halde fark edilmişti) | PM bulgusu (checkout-webhook-test-gaps refactor incelemesi) — düşük önem ama sessiz regresyon riski | `web/src/app/api/webhooks/payment/route.test.ts` |

### P3 — Faz 5 (henüz başlanmamış, iskelet)
| # | İş | Dosya |
|---|---|---|
| 23 | `/admin/videos` — video yükleme/yayın akışı | `web/src/app/admin/videos/page.tsx` |
| 24 | `/` — public video galerisi + `property_videos` anon RLS policy | `web/src/app/page.tsx`, migration |
| 25 | Supabase Storage bucket tanımı (video dosyaları için) | yeni migration |
| 26 | `properties`/`property_videos` tablolarını kullanan ilk gerçek kod | şu an hiç kullanılmıyor |

---

## 2. Sayfa/Ekran Envanteri ve Olmazsa Olmazlar

Her sayfa için: mevcut durum + "production-ready" sayılması için olmazsa olmaz (zorunlu) maddeler.

### `/` — Ana Sayfa (anonim ziyaretçi)
**Durum:** İskelet (statik metin).
**Olmazsa olmazlar:**
- [ ] Gerçek video galerisi (public, `property_videos` üzerinden)
- [ ] Anon RLS policy (`property_videos`, `properties` için public select)
- [ ] `layout.tsx` metadata'sının "Create Next App"ten güncellenmesi, `lang="tr"`
- [ ] Boş durum (henüz video yoksa) mesajı

### `/login` — Giriş
**Durum:** Çalışıyor ama tek yönlü (sadece admin redirect).
**Olmazsa olmazlar:**
- [ ] Role-aware redirect (admin → `/admin/listings`, emlakçı → `/agent/dashboard`)
- [ ] Kayıt (signup) akışı + `agents` satırı otomatik oluşturma
- [ ] Şifre sıfırlama akışı
- [ ] Çıkış (logout) butonu/akışı
- [ ] Hatalı giriş mesajı (şu an var mı doğrulanmadı — kontrol edilmeli)

### `/admin/listings` — Admin İlan Onay
**Durum:** Tamamlanmış MVP, test yok.
**Olmazsa olmazlar:**
- [ ] Sayfalama (pending listesi büyüyünce)
- [ ] Filtre/arama (şehir, tarih, skor)
- [ ] Düzenleme (onaylamadan önce başlık/fiyat düzeltme)
- [ ] Server Action seviyesinde admin kontrolü (RLS'e ek, defense-in-depth)
- [ ] Sayfa + action testleri
- [ ] Hata mesajı sızıntısını kapat (`error.message` doğrudan UI'a basılmasın)

### `/admin/videos` — Admin Video Onay
**Durum:** İskelet ("Faz 5'te eklenecek").
**Olmazsa olmazlar:**
- [ ] Video yükleme UI (Supabase Storage entegrasyonu)
- [ ] `property_videos` draft/published durum yönetimi
- [ ] Önizleme oynatıcı
- [ ] Onay/red akışı (admin/listings ile tutarlı pattern)

### `/agent/dashboard` — Emlakçı Paneli
**Durum:** İskelet (sadece abonelik rozeti), auth guard yok.
**Olmazsa olmazlar:**
- [ ] Auth guard (oturumsuzsa `/login`'e redirect)
- [ ] `listings` tablosundan abone ilan akışının gösterilmesi (ana ürün değeri)
- [ ] Abonelik durumu rozetinin tüm durumları kapsaması (`trialing`, `active`, `past_due`, `canceled`)
- [ ] Boş durum (henüz ilan yoksa) mesajı
- [ ] Sayfalama/filtre (ilan sayısı büyüyünce)

### `/pricing` — Plan Seçimi
**Durum:** Kodlanmış, commit edilmemiş, **canlıda kırık** (`sort_order` hatası).
**Olmazsa olmazlar:**
- [ ] `sort_order` kolon hatasının düzeltilmesi (P0-2)
- [ ] `plans` tablosuna seed verisi (Free/Başlangıç/Pro) — hiçbir migration'da yok
- [ ] Anonim kullanıcı için net CTA ("Giriş yap ve satın al")
- [ ] Ödeme hata mesajlarının (401/409/429/5xx) kullanıcı dostu Türkçe karşılıkları — kısmen var, 502/504 kontrol edilmeli

### `/account/subscription` — Abonelik Detayı
**Durum:** Kodlanmış, commit edilmemiş, çoklu-satır durumunda kırılgan.
**Olmazsa olmazlar:**
- [ ] Status filtresi (aktif/en son kaydı seçme) — P1-9
- [ ] `past_due` durumunda net bir "ödeme güncelle" CTA'sı
- [ ] İptal/plan değiştirme akışı (şu an yok)
- [ ] Fatura geçmişi (payment_events'ten, opsiyonel ama beklenir)

### `/api/subscriptions/checkout`, `/api/subscriptions/[id]`, `/api/webhooks/payment` (API uçları)
**Olmazsa olmazlar (hepsi için ortak):**
- [ ] 400/502/504/409/23505 senaryoları için test (P2-16)
- [ ] Webhook `subscription_id` güvenlik doğrulaması (P0-5)
- [ ] `needs_review` durumunun gerçekten DB'ye yazılması (P1-11)
- [ ] Rate limit'in bellek-içi değil kalıcı/paylaşımlı olması (çoklu instance için)

---

## 3. Diyagramlar

Aşağıdaki görsel diyagramlar ayrıca gösterildi (mimari + veri akışı + ödeme durum makinesi). Kaynak: proje-dokumantasyonu.md §2 ve §7.
