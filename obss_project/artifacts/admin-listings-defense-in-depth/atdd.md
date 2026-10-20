---
task_slug: admin-listings-defense-in-depth
jira_id: EML-36
threat_model: done
priority: high
coverage_target: 90
performance_target: null
memory_target: null
test_strategy:
  unit: 80
  integration: 20
  e2e: 0
affected_modules:
  - web/src/lib/auth/requireAdmin.ts (yeni)
  - web/src/app/admin/listings/actions.ts
  - web/src/app/admin/listings/page.tsx
---

# ATDD — admin-listings-defense-in-depth

## Jira Kaynağı
[EML-36 — [P1] Admin ilan onay paneli — uygulama seviyesi admin kontrolü + hata mesajı sızıntısı (P1-8)](https://kuyusuzyusuf123.atlassian.net/browse/EML-36)
Kaynak: `is-listesi-ve-sayfa-envanteri.md` P1-8, `emlak-platform-customer`
session önerisi (genişletildi — kod incelemesinde `page.tsx`'in de hiç
guard'ı olmadığı bulundu).

## Persona
Oturum açmış ama admin OLMAYAN bir kullanıcı (emlakçı/agent) — ya
doğrudan `/admin/listings`'e girer, ya da Server Action'ları (form
submit dışında, örn. DevTools'tan) doğrudan çağırır.

## Hedef (Neden)
Şu an TEK yetki katmanı RLS/SECURITY INVOKER RPC — uygulama kodunda hiç
önceden kontrol yok (defense-in-depth eksik). Ayrıca `error.message`
hem `actions.ts`'de hem `page.tsx`'de doğrudan istemciye gösteriliyor
(DB hata detayı sızıntısı).

## User Story
As a sistem işletmecisi (Yusuf)
I want admin paneline ve işlemlerine uygulama seviyesinde de bir admin
  kontrolü eklenmesini ve hata mesajlarının DB detayı sızdırmamasını
So that RLS tek başarısızlık noktası olmaktan çıksın, hata mesajları
  içeriden bilgi sızdırmasın

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] **AC-S1 (Elevation)** Given oturum açmış ama
   `agents.is_admin = false` olan bir kullanıcı, When `approveListing`
   (veya `rejectListing`) Server Action'ı çağrılır, Then
   `supabase.rpc("approve_raw_listing"/"reject_raw_listing", ...)` HİÇ
   ÇAĞRILMAZ, generic bir hata throw edilir ("Bu işlem için yetkiniz
   yok"), `raw_listings`/`listings` tablosunda hiçbir yazma denemesi
   olmaz.
2. [Critical] **AC-S2 (Elevation)** Given/When: oturum yok →
   `redirect("/login")` (hem `page.tsx`'te hem action'larda); oturum
   var ama admin değil → `page.tsx`'te `redirect("/agent/dashboard")`.
   Then her iki durumda da `raw_listings` sorgusu/RPC'si ÇALIŞMAZ.
3. [Critical] **AC-S3 (Info disclosure)** Given RPC veya sorgu gerçek
   bir hata döner (DB hatası, network vb.), When kullanıcıya yanıt
   gösterilir, Then gerçek `error.message` İSTEMCİYE HİÇ GİTMEZ — sadece
   generic bir mesaj ("İlan onaylanamadı, lütfen tekrar deneyin" /
   "İlanlar yüklenemedi, lütfen tekrar deneyin"), gerçek hata
   `console.error` ile sunucu logunda kalır.
4. [High] Given admin kullanıcı (`is_admin = true`), When
   `approveListing`/`rejectListing` çağrılır, Then mevcut davranış
   AYNEN korunur (RPC çağrılır, başarılıysa `revalidatePath`).
5. [High] Given admin kullanıcı, When `/admin/listings`'e girer, Then
   sayfa normal şekilde render edilir (mevcut davranış korunur).

## Threat Model
Çağrıldı — STRIDE-lite: Elevation (AC-S1: app-level admin kontrolü RPC'den
önce; AC-S2: page.tsx'in kendi auth/admin guard'ı) ve Info disclosure
(AC-S3: error.message sızıntısı) eklendi. Tampering/Spoofing/DoS/
Repudiation bu değişiklik kapsamında tetiklenmedi (DoS/rate-limit zaten
kapsam dışı bırakılmış bir admin aracı; is_admin escalation koruması
ayrı bir migration'da zaten var, bu görevin konusu DEĞİL).

Bu, bir yetkilendirme (authorization) AC'si olduğu için **`authz-test`
skill'i de çağrılmalı** (plan'dan sonra, verify'ın bir parçası olarak) —
IDOR/RLS testleri kendi kalıbını gerektiriyor; bu görevde "IDOR" yok
(tek kaynak tipi, tenant/owner ayrımı değil, rol bazlı erişim) ama
`authz-test`'in canlı doğrulama felsefesi (gerçek bir non-admin
hesapla gerçek bir RPC çağrısı deneyip RLS'in reddettiğini canlı
doğrulamak) `verify` adımında bir gate olarak uygulanacak.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Admin, happy path | Mevcut davranış (throw yok) | RPC çalışır, revalidate | Sayfa güncellenir | AC-4 |
| 2 | Admin olmayan, action çağırır | throw "Bu işlem için yetkiniz yok" | RPC'ye hiç gidilmez | Form hata mesajı | AC-S1 |
| 3 | Oturum yok, page.tsx | redirect /login | Sorgu hiç yapılmaz | /login sayfası | AC-S2 |
| 4 | Oturum var admin değil, page.tsx | redirect /agent/dashboard | Sorgu hiç yapılmaz | /agent/dashboard | AC-S2 |
| 5 | Gerçek DB hatası (herhangi bir akışta) | throw/render generic mesaj | Gerçek hata SADECE console.error'da | Generic hata metni | AC-S3 |
| 6 | Hiçbir şey yapılamadı ama hata yok | Oluşmaz — her dal (redirect, throw, render) açık bir sonuç üretir | — | — | Tüm AC'ler |

Kısmi başarı: Uygulanamaz — admin kontrolü ya hepsi ya hiçbiri (RPC
çağrılır veya çağrılmaz, ikili).
Boş sonuç ↔ hata ayrımı: `raw_listings` boş dizi (gerçek admin, hiç
bekleyen ilan yok) ile yetkisiz erişim (sorgu hiç yapılmadı) AYRI
dallardır — ikisi karıştırılmaz, mevcut "İncelenmemiş ilan yok" mesajı
SADECE admin+boş-sonuç durumunda gösterilir.

## Test Strategy
Unit: 80% — `requireAdmin()` helper'ının saf mantığı (oturum yok/admin
değil/admin — 3 dal), `actions.ts`'in `rpc` spy'ının admin-değilken
ÇAĞRILMADIĞI, `page.tsx`'in redirect çağrıları, generic hata mesajları
(mevcut `account/subscription/page.test.tsx` deseni — mock'lu Supabase
client, doğrudan fonksiyon çağrısı).
Integration: 20% — `supabase-check`/`authz-test` felsefesiyle: gerçek
olmayan ama tam zincirli bir mock (agents tablosu sorgusu → is_admin
okuma → karar) ile uçtan uca akış.
E2E: 0% — gerçek bir admin/non-admin hesabı ve tarayıcı akışı kapsam
dışı.

## Benchmark / Başarı Ölçütü
Coverage Target: Değişen dosyalarda (`requireAdmin.ts`, `actions.ts`,
`page.tsx`) satır %90, dal %100 (güvenlik yolu, her dal test edilmeli).
Performance Target: Yok.
Görsel/UI kriteri: Yok — sadece hata mesajı metni ve redirect davranışı
değişiyor, `vision-test` tetiklenmiyor.

## Kapsam Dışı
- RLS politikalarının kendisi değiştirilmiyor (zaten doğru).
- `is_admin` escalation koruması (migration 0004/0005'te zaten var).
- Rate limiting / brute-force koruması (admin paneli, düşük risk, bu
  fazda bilinçli olarak kapsam dışı — zaten az sayıda admin kullanıcısı
  var).
- Audit log (kim neyi onayladı/reddetti) — ayrı bir görev olabilir,
  bu görevin konusu değil.

## Etkilenen Dosyalar/Modüller (bilinen)
- `web/src/lib/auth/requireAdmin.ts` (YENİ — paylaşılan helper, `{supabase, user}` döner, page için redirect/action için throw davranışı parametreyle seçilir)
- `web/src/app/admin/listings/actions.ts` (değiştir)
- `web/src/app/admin/listings/page.tsx` (değiştir)
- Yeni test dosyaları: `web/src/lib/auth/requireAdmin.test.ts`, `web/src/app/admin/listings/actions.test.ts`, `web/src/app/admin/listings/page.test.tsx`

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulandı (önceki görevlerde zaten doğrulandı).

## Rollback Beklentisi
Davranış değişikliği geriye dönük uyumsuz değil — sadece eksik bir
guard ekleniyor. Admin kullanıcılar için mevcut davranış AYNEN korunuyor
(AC-4/5).

## Risks
- Rate limiting/audit log bilinçli olarak kapsam dışı bırakıldı (yukarıda
  gerekçeli).
- `requireAdmin()` helper'ının page/action arasındaki davranış farkı
  (redirect vs throw) bir parametreyle yönetiliyor — yanlış kullanılırsa
  (örn. bir action'da redirect çağrılırsa) Next.js'te garip bir davranış
  oluşabilir; code-copilot'a net talimat verilecek.

## Assumptions
- `requireAdmin()` tek bir paylaşılan helper olarak yazılacak (Opus
  alt-ajanı önerisi) — 3 yerde kod tekrarı yerine.

## Unknowns
Yok.

## Sorular ve Cevaplar (ham kayıt)
1. App-level kontrol deseni → RPC'den önce is_admin kontrolü, throw (Opus alt-ajanı tarafından yanıtlandı)
2. Oturum yok (action) → redirect("/login") (Opus alt-ajanı tarafından yanıtlandı)
3. Oturum yok (page) → redirect("/login") (Opus alt-ajanı tarafından yanıtlandı)
4. Admin değil (page) → redirect("/agent/dashboard") (Opus alt-ajanı tarafından yanıtlandı)
5. Hata mesajı → generic + console.error (Opus alt-ajanı tarafından yanıtlandı)
6. Helper → paylaşılan requireAdmin() (Opus alt-ajanı tarafından yanıtlandı)
7. Test oranı → unit 80/integration 20/e2e 0 (Opus alt-ajanı tarafından yanıtlandı)
8. Coverage → satır %90/dal %100 (Opus alt-ajanı tarafından yanıtlandı)
9. Threat-model AC sayısı → 3 (AC-S1/S2/S3) (Opus alt-ajanı tarafından yanıtlandı)
10. Kapsam dışı → RLS/escalation koruması (Opus alt-ajanı tarafından yanıtlandı)
11. Doğrulama yöntemi → rpc spy not.toHaveBeenCalled() + from yazma yok (Opus alt-ajanı tarafından yanıtlandı)
