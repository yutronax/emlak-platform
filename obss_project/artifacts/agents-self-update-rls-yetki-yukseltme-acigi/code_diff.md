# Code Diff — agents-self-update-rls-yetki-yukseltme-acigi

## Oluşturulan dosyalar
- `supabase/migrations/0004_fix_agents_self_update_rls.sql` — plan.md'deki
  SQL ile birebir eşleşiyor (`Read` ile doğrulandı): `prevent_self_is_admin_escalation()`
  fonksiyonu (security definer, search_path=public) + `agents_prevent_self_is_admin_escalation`
  BEFORE UPDATE trigger'ı. `is_admin` değişip `auth.role() <> 'service_role'`
  ise `errcode 42501` ile reddediyor.

## Değiştirilen dosyalar
Yok — `0001_init.sql`/`0002_admin_review.sql`/`0003_subscriptions_payment.sql`
dokunulmamış (git status ile doğrulandı), test dosyası (`agents-self-update-rls.test.ts`)
dokunulmamış.

## AC karşılanma durumu
| AC | Karşılandı mı | Not |
|---|---|---|
| AC-1 (happy path) | Evet | `is_admin` değişmediği için trigger hiç tetiklenmiyor, update normal işliyor |
| AC-S1 (is_admin yükseltme reddi) | Evet | `new.is_admin is distinct from old.is_admin` + rol kontrolü → 42501 |
| AC-S2 (başka kullanıcı) | Evet (regresyon, mevcut davranış) | Bu migration'ın kapsamında değil — `agents_self_update`'in `USING` koşulu zaten engelliyor, trigger bunu değiştirmiyor |
| AC-2 (id/created_at değişmez) | Dolaylı | Trigger sadece `is_admin`'i kontrol ediyor; `id` zaten primary key/immutable, `created_at` için ayrı bir koruma YOK — bu bir sınırlama (aşağıya not edildi) |
| AC-3 (service_role admin akışı) | Evet | `auth.role() = 'service_role'` istisnası |

## Kalan sınırlamalar
- Migration henüz gerçek Supabase projesine UYGULANMADI — sadece dosya
  diskte. `verify`/`supabase-check` adımında gerçek projeye uygulanıp
  test suite'inin (service_role key eklendiğinde) çalıştırılması gerekiyor.
- AC-2 (`created_at` alanının değişmezliği) için trigger'da açık bir koruma
  yok — atdd.md bu satırı "Davranış Sözleşmesi'nde kapsam is_admin ile
  sınırlı olsa da regresyon için not edilir" diye zaten düşük öncelikli
  işaretlemişti (High, Critical değil); `pm` incelemesinde bu sınırlamanın
  kabul edilebilir olup olmadığı değerlendirilmeli.

## Varsayımlar
- `auth.role()` fonksiyonunun Supabase projesinde mevcut/erişilebilir
  olduğu varsayıldı (standart Supabase `auth` şemasının bir parçası).

## CAVEMAN self-review
- Yeni dosya: sadece 1 migration dosyası (gerekli minimum).
- Yeni soyutlama/yardımcı fonksiyon: 1 trigger fonksiyonu — zorunlu (Postgres
  BEFORE UPDATE trigger'ları için fonksiyon şart, kaçınılamaz).
- Spekülatif genişletme yok — sadece `is_admin` kontrolü, başka kolon/tablo
  eklenmedi.
