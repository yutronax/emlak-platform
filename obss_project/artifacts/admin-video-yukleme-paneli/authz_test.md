# Authz Test Matrisi — admin-video-yukleme-paneli

Jira: EML-11

## Aktörler
- **Admin (A)** — `agents.is_admin = true` olan bir agent kaydı.
- **Sahip-olmayan agent (B)** — `is_admin = false`, kendi property'si var ama hedef property kendisine ait değil.
- **Sahip agent (C)** — `is_admin = false`, hedef property kendisine ait (mevcut owner davranışı, regresyon).
- **anon key** — kimliksiz.

## Test Matrisi

| # | Aktör | İşlem | Beklenen | AC |
|---|---|---|---|---|
| 1 | Admin (A) | `property_videos` INSERT — hedef property **kendisine ait değil** | 200/201, satır oluşur | AC-S3 |
| 2 | Admin (A) | `property_videos` UPDATE (status=published) — hedef property kendisine ait değil | 200, status değişir | AC-S3 |
| 3 | Sahip-olmayan agent (B) | `property_videos` INSERT — hedef property B'ye ait değil, admin de değil | 401/403 (42501) — satır oluşmaz, service_role ile tekrar okunup doğrulanır | AC-S2 |
| 4 | Sahip-olmayan agent (B) | `property_videos` UPDATE — başka birinin videosu | 403/404 **ve** veri değişmemiş olmalı (service_role ile tekrar okunur) | AC-S2 |
| 5 | Sahip agent (C) | `property_videos` INSERT — **kendi** property'si (regresyon, mevcut owner policy) | 200/201, satır oluşur — bu testin PASS olması mevcut owner davranışının bozulmadığını kanıtlar | AC-1 (regresyon) |
| 6a | anon key | `property_videos` SELECT | `200 + []` — bu Supabase RLS'in NORMAL davranışı (canlı doğrulandı: anon SELECT, policy eşleşmezse sessizce filtreler, 401/403 DEĞİL). Test, `200+[]`'i "veri yok" ile karıştırmamak için ÖNCE service_role ile satırın gerçekten var olduğunu kanıtlar, sonra anon'un 0 satır gördüğünü gösterir. | AC-S2 |
| 6b | anon key | `property_videos` INSERT | `401` + `code: 42501` (canlı doğrulandı — yazma denemesi her zaman RLS ihlali hatası fırlatır, SELECT'ten farklı) | AC-S2 |
| 7 | Admin (A) | Storage'a (`property-videos` bucket) başka bir property'nin önekiyle yazma | 200, dosya yazılır | AC-S3 |
| 8 | Sahip-olmayan agent (B) | Storage'a (`property-videos` bucket) herhangi bir property önekiyle yazma | 401/403 — dosya Storage'da oluşmaz (service_role ile liste kontrolü) | AC-S2 |
| 9 | — (app-level, server action) | Admin, seçili `property_id=X` ama `storage_path` önekinde `Y` (farklı bir property) gönderir | Server action reddeder (`{ok:false, error:"PATH_MISMATCH"}`), `property_videos`'a hiçbir satır yazılmaz | AC-S1 |
| 10 | — (Storage erişimi) | `published` bir videonun **imzasız** public bucket URL'si ile istek | 403/erişim reddi | AC-S4 |
| 11 | — (Storage erişimi) | `published` bir videonun **signed URL** (admin tarafından üretilen, süreli) ile isteği | 200, video içeriği döner | AC-S4 |

## İki kural — bu görevde nasıl uygulandı
- **Boş liste geçmek değildir:** Satır 6a'da anon key `200+[]` döner — bu Supabase'in NORMAL RLS-filtreleme davranışı, bir hata değil. Test bunu "PASS" saymadan önce service_role ile satırın gerçekten var olduğunu (>0) kanıtlamalı; aksi halde "zaten veri yoktu" ile "RLS filtreledi" ayırt edilemez. (Not: Bu, canlı Supabase'e karşı doğrulandı — 2026-10-25, bkz. plan.md/code_diff.md'nin ilgili notu.)
- **Yazma testinde son durumu doğrula:** Satır 3/4/8'de sadece durum koduna bakmak yetmez — service_role ile veri/Storage listesi tekrar okunup değişmediği kanıtlanmalı.

## Mock kuralı
Tüm satırlar gerçek Supabase projesine (test/dev ortamı) karşı integration testi olarak yazılmalı — mock'lanmış client authz testini kanıtlamaz, FAIL sayılır.

## Canlı sonda
Migration henüz yazılmadı — bu adım sadece matris/strateji netleştirme. Canlı sonda, migration uygulandıktan ve `supabase-check` gate'i geçtikten SONRA `verify` adımında koşulacak (kullanıcının kendi Supabase projesinde, onayla).

## Kapsanmayan
- Satır "süresi geçmiş/bozuk token" (klasik matrisin 4. satırı) bu görevde ayrıca test edilmiyor — Supabase'in kendi auth token süre doğrulaması zaten platform seviyesinde, bu görevin RLS policy'sine özgü bir risk değil.
- Rol yükseltme denemesi (istekte `is_admin: true` gönderme) N/A — bu bir REST tablo sorgusu, `is_admin` zaten `agents` tablosunda ayrı bir alan ve `prevent_self_is_admin_escalation` trigger'ı ile zaten korunuyor (0004/0005 migration'ları), bu görevin kapsamında değil.
