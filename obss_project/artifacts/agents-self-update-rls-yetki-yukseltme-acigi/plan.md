# Plan — agents-self-update-rls-yetki-yukseltme-acigi
_Reference: atdd.md_

Frontend-pipeline: tetikleyici teknik olarak var (atdd.md'nin "Etkilenen
Dosyalar" listesinde `web/src/app/agent/dashboard/page.tsx` geçiyordu), ama
kod okunduğunda bu sayfanın `agents` tablosuna hiç dokunmadığı (sadece
`subscriptions.status` okuyup bir rozet gösteriyor) ve projede şu an hiçbir
agent-profil-güncelleme UI'ı bulunmadığı görüldü. Bu görev **tamamen
backend/RLS** — hiçbir `.tsx`/`.css` dosyası değişmeyecek. Discover/Audit/
Design Direction adımları bu yüzden atlandı; `page.tsx` aşağıdaki "Files to
Modify" listesinden çıkarıldı (gerçek bağımlılık değil).

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| _yok_ | — | — | — |

Mevcut hiçbir dosya değişmeyecek — `0001_init.sql`/`0002_admin_review.sql`
migration geçmişi düzenlenmez (uygulanmış migration'lar asla değiştirilmez).

## New Files
| File | Purpose | Alan |
|------|---------|------|
| `supabase/migrations/0004_fix_agents_self_update_rls.sql` | `agents_self_update` policy'sine `is_admin` koruması ekler (bkz. aşağıdaki TAM SQL) | backend |
| `web/src/test/rls-agents-self-update.test.ts` (veya projenin mevcut test klasörü yapısına uygun isim) | AC-1/AC-S1/AC-S2/AC-3 için gerçek Supabase'e karşı RLS entegrasyon testleri | backend |

### Migration 0004 — TAM içerik (code-copilot bunu birebir uygulayacak)
```sql
-- 0004_fix_agents_self_update_rls.sql
-- EML-18: agents_self_update policy'sinde WITH CHECK yoktu, authenticated
-- kullanıcı kendi satırında is_admin=true yapabiliyordu (privilege escalation).
-- Fix: BEFORE UPDATE trigger ile is_admin değişikliğini service_role dışında engelle.

create or replace function prevent_self_is_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'is_admin alanı bu yoldan değiştirilemez'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger agents_prevent_self_is_admin_escalation
  before update on agents
  for each row
  execute function prevent_self_is_admin_escalation();
```

**Neden trigger, WITH CHECK değil:** `WITH CHECK` ifadesinde OLD satırına
(önceki `is_admin` değerine) doğrudan referans yoktur — bir subquery ile
aynı tabloyu okumak, statement içindeki MVCC/command-counter davranışına
bağımlı ve güvenilmez bir varsayım olurdu. BEFORE UPDATE trigger'da `OLD`/
`NEW` kaydı açıkça mevcut, bu yüzden "değişti mi" kontrolü net ve
test edilebilir. `auth.role()` Supabase'in JWT `role` claim'ini okur
(`authenticated`/`anon`/`service_role`) — service_role zaten RLS'i bypass
eder ama trigger RLS'ten bağımsız HER ROLDE çalışır, bu yüzden explicit
istisna gerekli (yoksa admin paneli de kilitlenir, bkz. AC-3).
`errcode = '42501'` kullanımı, atdd.md'nin Davranış Sözleşmesi'nde
beklenen Postgres hata koduyla (42501) eşleşmesi için seçildi.

## Dependencies
- `agents` tablosu zaten `0001_init.sql`'de `id, company_name, phone,
  created_at` ile oluşturulmuş; `is_admin` kolonu `0002_admin_review.sql`'de
  eklenmiş. Trigger bu ikisinin üstüne eklenir, hiçbirini değiştirmez.
- `auth.role()` Supabase'in yerleşik bir fonksiyonu (schema `auth`) —
  proje migration'larında zaten `auth.uid()` kullanılıyor, `auth.role()`
  aynı şemadan gelir, ek bir bağımlılık değil.
- `web/src/lib/supabase/server.ts`'deki `createServiceRoleClient()` —
  admin tarafı `is_admin` değişikliklerinin bu client ile (service_role key)
  yapıldığı doğrulandı: kodda şu an `is_admin`'i değiştiren bir yer YOK
  (admin ataması muhtemelen Supabase Studio'dan elle yapılıyor) — bu,
  atdd.md'nin "Admin paneli service_role kullanıyor" varsayımını kısmen
  doğruluyor (altyapı hazır, henüz bir admin-atama endpoint'i yok) ve AC-3
  testinin service_role key'iyle direkt DB güncellemesi olarak yazılmasını
  gerektiriyor (bir API endpoint'i üzerinden değil).
- `web/src/test/fake-supabase.ts` mevcut — ama bu mock bir dosya, authz-test
  kuralı mock'lu RLS testini kabul etmiyor; yeni test dosyası gerçek
  Supabase client'ı (anon/service_role key, test projesi) kullanmalı, bu
  fake'i KULLANMAMALI.

## Migration Required?
Evet — `supabase/migrations/0004_fix_agents_self_update_rls.sql` (yukarıda
tam SQL verildi). Mevcut migration'lar (0001-0003) değiştirilmiyor, sadece
üstüne ekleniyor — projenin "uygulanmış migration düzenlenmez" kuralına uygun.

## Risks
(atdd.md'den taşındı, keşifle netleşenler eklendi)
- `auth.role()` NULL dönerse (örn. service_role dışı ama JWT'siz bir bağlam)
  `coalesce(..., '')` ile boş string'e düşürülüyor — bu durumda kontrol
  normal şekilde uygulanır (güvenli taraf), test matrisine bu durum (JWT'siz
  istek, anon key) zaten AC-S2 ek satırı olarak dahil.
- Mevcut üretim verisinde `is_admin=true` olan satırlar — bu migration'ın
  kendisi bunları değiştirmez, atdd.md'nin önerdiği salt-okunur denetim
  sorgusu migration'a dahil edilmedi (bilinçli: migration dosyaları sadece
  şema değiştirmeli, data audit ayrı bir adım/rapor olarak kullanıcıya
  sunulmalı — `verify` veya `pm` adımında hatırlatılacak).
- Trigger `security definer` ile tanımlı — `search_path = public` sabitlendi
  (fonksiyon içinde şema enjeksiyonu riskini kapatmak için, projenin
  `approve_raw_listing`/`reject_raw_listing` fonksiyonlarıyla aynı kalıp).

## Open Questions
Yok — atdd.md'nin Unknowns bölümü ("is_admin dışında başka yetki taşıyan
kolon var mı" ve "fix yöntemi") bu adımda çözüldü: şema taraması (`agents`
tablosunda `is_admin` dışında yetki taşıyan tek kolon yok) ve fix yöntemi
(BEFORE UPDATE trigger, yukarıda gerekçelendirildi) netleşti.
