---
task_slug: login-role-aware-redirect
jira_id: EML-45
threat_model: not-applicable
priority: medium
coverage_target: 85
performance_target: null
memory_target: null
test_strategy:
  unit: 90
  integration: 10
  e2e: 0
affected_modules:
  - web/src/app/login/actions.ts
---

# ATDD — login-role-aware-redirect

## Jira Kaynağı
[EML-45 — [P1] login/actions.ts — role-aware yönlendirme (P1-13)](https://kuyusuzyusuf123.atlassian.net/browse/EML-45)
Kaynak: `is-listesi-ve-sayfa-envanteri.md` P1-13, `emlak-platform-customer`
session önerisi — **düzeltildi**: customer "404" dedi, ama EML-36 zaten
`admin/listings/page.tsx`'e `requireAdmin()` guard'ı eklemişti (404 değil,
`/agent/dashboard`'a redirect). GERÇEK sorun: `login/actions.ts` HERKESİ
koşulsuz `/admin/listings`'e yönlendiriyor, admin olmayan için bu çift
redirect'e yol açıyor (login → /admin/listings → requireAdmin reddeder →
/agent/dashboard).

## Persona
Giriş yapan bir kullanıcı — admin veya emlakçı (agent).

## Hedef (Neden)
Admin olmayan bir kullanıcı için gereksiz bir ÇİFT redirect oluşuyor
(`/admin/listings`'e gidip hemen `/agent/dashboard`'a geri atılıyor) —
hem gecikme hem `/admin/listings`'in varlığını dolaylı olarak gösterme.

## User Story
As a giriş yapan kullanıcı
I want başarılı girişten sonra DOĞRU hedefe (admin ise /admin/listings,
  değilse /agent/dashboard) doğrudan yönlendirilmeyi
So that gereksiz bir çift redirect yaşamayayım

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given giriş yapan kullanıcının `agents.is_admin = true`,
   When giriş başarılı olur, Then DOĞRUDAN `/admin/listings`'e
   yönlendirilir (ara bir redirect olmadan).
2. [Critical] Given giriş yapan kullanıcının `agents.is_admin = false`
   (veya `agents` satırı yok/sorgu boş), When giriş başarılı olur, Then
   DOĞRUDAN `/agent/dashboard`'a yönlendirilir.
3. [High] Given `agents` sorgusu gerçek bir hata döner (network/DB
   hatası), When giriş başarılı olur, Then PESSİMİST varsayım uygulanır
   — admin DEĞİL kabul edilir, `/agent/dashboard`'a yönlendirilir
   (hata loglanır, kullanıcı giriş akışından ATILMAZ).
4. [Medium] Given mevcut `ensureAgentRow()` çağrısı (EML-42), When giriş
   akışı çalışır, Then bu çağrı AYNEN korunur, sadece onun SONRASINA
   is_admin okuma + role-aware redirect eklenir (sıra: signIn → getUser
   → ensureAgentRow → is_admin oku → redirect).

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | is_admin=true | Redirect /admin/listings | Yok | Admin paneli | AC-1 |
| 2 | is_admin=false | Redirect /agent/dashboard | Yok | Emlakçı paneli | AC-2 |
| 3 | agents satırı yok | Redirect /agent/dashboard | Yok | Emlakçı paneli | AC-2 |
| 4 | agents sorgusu hata | Redirect /agent/dashboard (pessimist) | console.error | Emlakçı paneli | AC-3 |
| 5 | Hiçbir şey yapılamadı ama hata yok | Oluşmaz — her dal açık bir redirect kararı üretir | — | — | Tüm AC'ler |

Kısmi başarı: Uygulanamaz — redirect kararı ikili (admin/değil).
Boş sonuç ↔ hata ayrımı: "agents satırı yok" (AC-2, normal — ensureAgentRow
henüz çalışmamış olabilir) ile "sorgu hatası" (AC-3, pessimist fallback)
AYRI ele alınır — ikisi de SONUÇTA aynı redirect'e gider ama loglama
farklıdır (ilki sessiz, ikincisi console.error).

## Threat Model
Tetikleyici yok — mevcut `is_admin` okuma deseni zaten `requireAdmin()`'de
var ve RLS (`agents_self_select`) ile korunuyor, bu görev sadece AYNI
okumayı login akışına taşıyor, yeni bir yetki sınırı/RLS değişikliği yok.

## Test Strategy
Unit: 90% — mock'lu `agents` sorgusu ile 4 dalın (admin/değil/yok/hata)
doğru redirect hedefini ürettiğini doğrulama (mevcut `login/actions.test.ts`
deseni genişletilir).
Integration: 10% — gerçek `requireAdmin()`'in kullandığı AYNI RLS
davranışına güvenildiği için ayrı bir canlı doğrulama gerekmez (zaten
EML-36'da doğrulanmış).
E2E: 0%.

## Benchmark / Başarı Ölçütü
Coverage Target: Değişen `login/actions.ts`'te satır/dal %85.
Performance Target: Yok (tek ek bir sorgu, ihmal edilebilir).
Görsel/UI kriteri: Yok.

## Kapsam Dışı
- `admin/listings/page.tsx`'in kendi guard'ı (EML-36'da zaten doğru) —
  DOKUNULMUYOR.
- `agents.is_admin`'in nasıl set edildiği (ayrı, zaten kapalı bir konu).

## Etkilenen Dosyalar/Modüller (bilinen)
- `web/src/app/login/actions.ts` (değiştir)
- `web/src/app/login/actions.test.ts` (genişlet — mevcut 5 test korunur)

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulandı (önceki görevlerde zaten doğrulandı).

## Rollback Beklentisi
Geriye dönük uyumsuz değil — admin kullanıcılar için SONUÇ aynı (zaten
/admin/listings'e ulaşıyorlardı, sadece aradaki redirect kalkıyor).

## Risks
Yok.

## Assumptions
Yok (atdd bu görevde doğrudan, Opus alt-ajanına dispatch edilmedi —
kapsam küçük ve net).

## Unknowns
Yok.

## Sorular ve Cevaplar (ham kayıt)
Bu görev küçük ve tek-dosyalı olduğu için netleştirme soruları Opus
alt-ajanına dispatch edilmedi, doğrudan kod incelemesiyle (EML-36'nın
`requireAdmin()` deseni referans alınarak) tasarlandı.
