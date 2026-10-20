---
task_slug: agent-dashboard-auth-ve-ilan-akisi
jira_id: EML-33
threat_model: done
priority: medium
coverage_target: 85
performance_target: "iki Supabase sorgusu (subscription + listings) Promise.all ile paralel çalışır"
memory_target: null
test_strategy:
  unit: 70
  integration: 25
  e2e: 5
affected_modules:
  - web/src/app/agent/dashboard/page.tsx
---

# ATDD — agent-dashboard-auth-ve-ilan-akisi

## Jira Kaynağı
[EML-33 — [P1] /agent/dashboard — auth guard + gerçek ilan akışı (P1-6 + P1-7)](https://kuyusuzyusuf123.atlassian.net/browse/EML-33)
Kaynak: `is-listesi-ve-sayfa-envanteri.md` P1-6/P1-7, `emlak-platform-customer`
session önerisi — **düzeltilmiş**: customer "kendi listings kayıtları
agent_id'ye göre RLS ile kısıtlı" demişti, ama gerçek şema (`0001_init.sql`)
bunu doğrulamıyor. `listings` tablosunda `agent_id` kolonu YOK — bu tablo
agent-özel değil, abonelik bazlı PAYLAŞILAN bir havuz
(`listings_subscriber_select` RLS politikası: aktif/trialing VE süresi
dolmamış abonelik yeterli, agent_id eşleşmesi yok). Agent-özel olan tablo
`properties`, bu görevin kapsamında DEĞİL.

## Persona
Giriş yapmış emlakçı (agent) — `/agent/dashboard`'u kendi iş akışının ana
girişi olarak kullanıyor.

## Hedef (Neden)
Şu an sayfa iki açıdan kırık: (1) oturum yoksa hiçbir yönlendirme yok,
sayfa boş rozetle hâlâ render oluyor (güvenlik/UX eksiği); (2) abonelik
sorgusu `.in("status",["active","past_due"])` ile yanlış filtrelendiği
için `trialing`/`canceled` durumundaki bir abonelik "Aboneliğiniz yok"
olarak gösteriliyor; (3) sayfanın asıl ürün değeri (ilan akışı) hiç
bağlı değil, sadece bir rozet var.

## User Story
As a giriş yapmış emlakçı
I want oturumum yoksa /login'e yönlendirilmeyi, aboneliğimin GERÇEK
  durumunu görmeyi ve aboneliğim varsa gerçek ilan akışını görmeyi
So that dashboard'u gerçekten iş akışımın merkezi olarak kullanabileyim

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] **AC-S1 (Elevation — auth guard)** Given oturum yok
   (`auth.getUser()` → `user: null`), When `/agent/dashboard`'a GET
   isteği yapılır, Then `redirect("/login")` (sunucu tarafında,
   `next/navigation`) tetiklenir, SAYFA İÇERİĞİ HİÇ render edilmez
   (ne rozet ne ilan listesi).
2. [Critical] **AC-S2 (RLS tek yetki kaynağı)** Given/When/Then: sayfa
   `listings` sorgusunu `createClient()` (cookie-tabanlı, RLS'e tabi)
   ile yapar, `createServiceRoleClient()` KULLANMAZ ve sorguya agent_id
   bazlı bir filtre EKLEMEZ — RLS tek yetki kontrolü olarak kalır (kod
   incelemesiyle doğrulanır, davranışsal bir test değil).
3. [Critical] Given oturum var, agent'ın `status IN
   ('trialing','active','past_due')` olan bir subscription satırı var
   (en yeni, `created_at desc` ile seçilir), When sayfa render edilir,
   Then rozet doğru Türkçe etikette: `trialing`→"Deneme sürümü",
   `active`→"Aktif", `past_due`→"Ödeme gecikmiş".
4. [High] Given agent'ın AÇIK (trialing/active/past_due) satırı yok
   ama en son satırı `status="canceled"`, When sayfa render edilir,
   Then rozet "İptal edildi".
5. [Medium] Given agent'ın hiç subscription satırı yok, When sayfa
   render edilir, Then rozet "Aboneliğiniz yok".
6. [Critical] Given agent'ın `active`/`trialing` VE `current_period_end
   > now()` olan bir aboneliği var (erişim koşulu, RLS'in kendi
   kuralıyla AYNI), When sayfa render edilir, Then `listings`
   tablosundan `order("created_at",{ascending:false}).limit(20)` ile
   çekilen kayıtlar listelenir (title, price+currency, city/district,
   rooms/area_m2 varsa).
7. [High] Given agent'ın erişim koşulu (AC-6) sağlanmıyor (abonelik yok/
   süresi dolmuş/past_due/canceled), When sayfa render edilir, Then
   `listings` sorgusu HİÇ YAPILMAZ (RLS'in boş dizi döndürmesine
   güvenilmez, erişim kararı subscription durumundan çıkarılır), "İlanları
   görmek için aktif abonelik gerekir" mesajı + `/account/subscription`'a
   giden bir "Abone olun" linki gösterilir.
8. [Medium] Given agent'ın erişim koşulu sağlanıyor AMA `listings` havuzu
   boş (0 satır), When sayfa render edilir, Then nötr bir boş durum
   mesajı ("Şu an gösterilecek ilan yok") gösterilir, CTA YOK (erişimi
   var, sadece havuz boş).

## Threat Model
Çağrıldı — AC-S1 (Elevation: auth guard eksikliği kapatıldı, oturumsuz
erişimde sayfa hiç render edilmez) ve AC-S2 (yetki kontrolü tek kaynağı:
RLS; sayfa kendi agent_id filtresi veya service-role client kullanarak
bu kontrolü ikinciye düşürmez/bypass etmez) eklendi. Diğer STRIDE
kategorileri (Spoofing: Supabase Auth zaten var; Tampering/DoS: kullanıcı
girdisi yok; Repudiation: uygulanamaz) bu değişiklik kapsamında
tetiklenmedi.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Oturum yok | HTTP redirect (302) /login'e | Yok | /login sayfası | AC-S1 |
| 2 | Oturum var, abonelik trialing/active/past_due | 200, sayfa render | Yok | Doğru Türkçe rozet | AC-3 |
| 3 | Oturum var, en son durum canceled | 200, sayfa render | Yok | "İptal edildi" | AC-4 |
| 4 | Oturum var, hiç subscription yok | 200, sayfa render | Yok | "Aboneliğiniz yok" | AC-5 |
| 5 | Erişim koşulu sağlanıyor, listings dolu | 200, sayfa render | Yok | İlan listesi (≤20) | AC-6 |
| 6 | Erişim koşulu sağlanmıyor | 200, sayfa render | `listings` sorgusu YAPILMAZ | Abone-ol CTA'sı | AC-7 |
| 7 | Erişim koşulu sağlanıyor, listings boş | 200, sayfa render | Yok | "Şu an gösterilecek ilan yok" | AC-8 |
| 8 | Hiçbir şey yapılamadı ama hata yok | Oluşmaz — her dal (redirect, 4 rozet durumu, 3 liste durumu) ayrı ayrı render edilen bir sonuç üretir, sessiz boş sayfa yok | — | — | Tüm AC'ler |

Kısmi başarı: Subscription sorgusu hata verirse (`error` dolu) mevcut
davranış korunur ("Abonelik durumu yüklenemedi"), bu durumda erişim
koşulu SAĞLANMAMIŞ sayılır (pessimist varsayım — hata = erişim yok,
listings sorgusu atlanır).
Hiçbir şey yapılamadı ama hata yok: Oluşmaz — redirect ya tetiklenir ya
tetiklenmez (ikili), rozet/liste durumları yukarıdaki 7 dalın biri.
Boş sonuç ↔ hata ayrımı: `listings` boş dizi (AC-8, erişim VAR ama havuz
boş) ile erişim koşulu sağlanmadığı durum (AC-7, sorgu hiç yapılmaz)
AYRI dallardır — ikisi de kullanıcıya farklı mesaj gösterir, "boş" ile
"erişimin yok" karıştırılmaz.

## Test Strategy
Unit: 70% — `account/subscription/page.test.tsx`'teki desen: Server
Component'i doğrudan çağırıp render edilen React elemanını/HTML'i
incele, `createClient`/`redirect` (next/navigation) mock'lanır. Rozet
etiketleme mantığı (status→label), erişim kararı mantığı (current_period_end
kontrolü dahil) ayrı saf fonksiyonlar olarak test edilir.
Integration: 25% — `fake-supabase.ts` ile gerçek sorgu zincirini
(`.order().limit()`, `.in()`) uçtan uca (mock DB üzerinden) doğrulama.
E2E: 5% — Playwright MCP ile tek bir smoke testi: oturumsuz erişim →
/login'e yönlendiriliyor mu (gerçek tarayıcı, gerçek redirect davranışı).
Tam bir e2e suite (gerçek oturum + seed veri) kapsam dışı.

## Benchmark / Başarı Ölçütü
Coverage Target: Değişen `page.tsx` ve yardımcı fonksiyonlarında (status→
label, erişim kararı) satır/dal kapsamı ≥85%.
Performance Target: İki Supabase sorgusu (subscription durumu + listings,
erişim koşulu sağlanıyorsa) `Promise.all` ile PARALEL çalıştırılır,
sıralı (sequential) await YAPILMAZ.
Görsel/UI kriteri: Yok — sayfa basit bir liste + rozet, DOM/accessibility-tree
kontrolleri (component testleri) yeterli, `vision-test` bu görevde
tetiklenmiyor.

## Kapsam Dışı
- Sayfalama (pagination) — ilk 20 kayıt yeterli.
- `properties` tablosu (agent-özel mülk yönetimi) — bu görev sadece
  `listings` (paylaşılan havuz) ile ilgili.
- `pending`/`failed`/`needs_review` durumları için özel Türkçe etiket —
  mevcut genel fallback (`Abonelik: ${status}`) yeterli, bu durumlar
  nadir/geçici.
- Tam bir e2e test suite'i (gerçek oturum + seed veri).

## Etkilenen Dosyalar/Modüller (bilinen)
- `web/src/app/agent/dashboard/page.tsx` (değiştir)
- `web/src/app/agent/dashboard/page.test.tsx` (yeni)

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulandı (önceki görevlerde zaten doğrulandı) — git reposunun kökü
proje klasörüyle aynı, arama bu klasörle sınırlı.

## Rollback Beklentisi
Davranış değişikliği geriye dönük uyumsuz değil — sadece eksik bir
guard/sorgu ekleniyor, mevcut hiçbir kullanıcı akışı kırılmıyor (oturumlu
kullanıcılar zaten aynı sayfayı görüyordu, şimdi daha doğru bilgiyle).

## Risks
- `listings` havuzunun gerçek içeriği/hacmi bilinmiyor — 20 kayıt limiti
  bir varsayım, gerçek kullanım verisiyle revize edilebilir.
- RLS'in `current_period_end > now()` kuralıyla sayfanın kendi erişim
  kararı (aynı kuralı tekrar eden) arasında bir senkronizasyon riski var
  — ikisi ayrı yerlerde (DB politikası + sayfa kodu) aynı mantığı
  tutuyor, biri değişirse diğeri unutulabilir. Bilinçli kabul edildi
  (AC-S2'nin "RLS tek yetki kaynağı" ilkesiyle hafifletiliyor — sayfa
  kararı sadece UX için, gerçek veri erişimi hep RLS'e bağlı).

## Assumptions
- "Mevcut/geçerli abonelik" seçimi: açık (trialing/active/past_due) satır
  varsa o, yoksa en son satır (örn. canceled) — Opus alt-ajanı tarafından
  önerildi, kullanıcıya ayrıca onaylatılmadı.

## Unknowns
Yok.

## Sorular ve Cevaplar (ham kayıt)
1. Auth guard mekanizması → `redirect("/login")`, next/navigation, server-side (Opus alt-ajanı tarafından yanıtlandı)
2. Mevcut abonelik seçimi → açık satır öncelikli, yoksa en son satır (Opus alt-ajanı tarafından yanıtlandı)
3. Rozet etiketleri → trialing/active/past_due/canceled için Türkçe, diğerleri fallback (Opus alt-ajanı tarafından yanıtlandı)
4. Listings feed → limit 20, created_at desc, pagination yok (Opus alt-ajanı tarafından yanıtlandı)
5. Erişimi olmayan agent → CTA (/account/subscription linki) (Opus alt-ajanı tarafından yanıtlandı)
6. Happy path alanları → title/price+currency/city+district/rooms+area_m2 (Opus alt-ajanı tarafından yanıtlandı)
7. Erişim yok edge case → listings sorgusu hiç yapılmaz, CTA (Opus alt-ajanı tarafından yanıtlandı)
8. Erişim var ama havuz boş → nötr mesaj, CTA yok (Opus alt-ajanı tarafından yanıtlandı)
9. Threat-model → AC-S1/AC-S2 (Opus alt-ajanı tarafından yanıtlandı)
10. Test oranı → unit 70/integration 25/e2e 5 (Opus alt-ajanı tarafından yanıtlandı)
11. Coverage/performans → %85, Promise.all paralellik (Opus alt-ajanı tarafından yanıtlandı)
12. Görsel/UI kriteri → yok, vision-test tetiklenmiyor (Opus alt-ajanı tarafından yanıtlandı)
