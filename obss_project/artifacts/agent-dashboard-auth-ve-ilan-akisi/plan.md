# Plan — agent-dashboard-auth-ve-ilan-akisi
_Reference: atdd.md_

Frontend-pipeline: tetikleyici VAR (`.tsx` dosyası) — `frontend-pipeline`
skill'i çağrıldı. Bu bir UI reshape/yeni tasarım DEĞİL, veri bağlama +
auth guard bug fix'i olduğu için Design Direction adımı bilinçli olarak
atlandı (mevcut Tailwind utility class stili, mevcut sayfa yapısı
korunuyor). Discover: sayfa zaten kod okumasıyla biliniyor (basit
başlık+rozet+liste, ayrı bir component kütüphanesi yok). Audit: atdd.md
"Görsel/UI kriteri: Yok" diyor, `vision-test` bu görevde tetiklenmiyor —
bu nedenle `better-interface` taraması da atlandı (sadece layout/stil
değişmiyor, veri bağlanıyor).

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| web/src/app/agent/dashboard/page.tsx | Auth guard (AC-S1), abonelik sorgusu düzeltmesi (AC-3/4/5), erişim kararı + listings sorgusu (AC-6/7/8) | medium | frontend |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| web/src/app/agent/dashboard/page.test.tsx | AC-S1, AC-S2 (kod incelemesi), AC-3..8 için testler | frontend |

## Dependencies
- **`web/src/app/account/subscription/page.tsx` ile AYNI desen takip
  edilecek:** `createClient()` (RLS'e tabi, service-role KULLANILMAZ —
  AC-S2'nin gereği), `auth.getUser()`, `redirect("/login")` (next/navigation)
  oturum yoksa. Next.js 16 Cache Components için `export const instant =
  false;` zaten `page.tsx`'te var, korunacak.
- **Mevcut `BADGE_LABELS`/`badgeLabel()` fonksiyonu GENİŞLETİLECEK** (yeni
  bir dosyaya çıkarılmayacak — CAVEMAN, mevcut dosyada kalan küçük bir
  değişiklik): `trialing`→"Deneme sürümü", `canceled`→"İptal edildi"
  eklenir (mevcut `active`/`past_due` zaten var).
- **Abonelik sorgusu düzeltmesi:** `.in("status",["trialing","active","past_due"])`
  (AÇIK durumlar) `.order("created_at",{ascending:false}).limit(1).maybeSingle()`.
  0 satır dönerse (açık satır yok), AYRI bir ikinci sorgu: TÜM satırlar
  arasından en son (`created_at desc limit 1`) — bu "canceled" (veya diğer
  kapanmış) durumu yakalar. İki sorgu `Promise.all` ile paralel
  BAŞLATILAMAZ (ikincisi ilkinin sonucuna bağımlı — sadece 0 satırsa
  çalışır), bu sıralı kalır; atdd.md'nin "Promise.all" performans hedefi
  SADECE subscription-sorgusu-grubu İLE listings-sorgusu arasında geçerli
  (ikisi birbirine bağımlı değil, erişim kararı çıkarılabilir durumda
  paralel başlatılabilir — ama erişim kararı subscription sonucuna
  bağımlı olduğu için GERÇEKTE listings sorgusu subscription sonucu
  belirlendikten SONRA başlar; "Promise.all" atdd.md'nin düşündüğü kadar
  uygulanabilir değil, bu bir plan-aşaması düzeltmesi, bkz. Open Questions).
- **Erişim kararı** (AC-6/7): açık satırın `status in ('active','trialing')`
  VE `current_period_end > now()` olması — bu, `listings_subscriber_select`
  RLS politikasının (0001_init.sql) BİREBİR aynı kuralı, sayfa kodunda
  tekrarlanıyor (sadece UX kararı için, AC-S2 gereği gerçek erişim kontrolü
  hep RLS'te kalıyor).
- **`listings` sorgusu:** `.from("listings").select("id,title,price,currency,rooms,area_m2,city,district").order("created_at",{ascending:false}).limit(20)`
  — SADECE erişim kararı true ise çalıştırılır.

## Migration Required?
No — hiçbir şema değişikliği yok, sadece mevcut tabloları okuyan sorgu
mantığı değişiyor.

## Risks
(atdd.md'den taşındı, bu adımda bir düzeltme bulundu — bkz. Open Questions)
- RLS'in `current_period_end > now()` kuralıyla sayfanın kendi erişim
  kararı arasındaki senkronizasyon riski (atdd.md'de zaten not edilmiş).
- `listings` havuzunun gerçek hacmi bilinmiyor, 20 kayıt limiti varsayım
  (atdd.md'de zaten not edilmiş).

## Open Questions
Yok — atdd.md'nin Unknowns bölümü boştu. Bu `plan` adımının kendi keşfinde
TEK bir teknik gerçeklik düzeltmesi ortaya çıktı (bir kullanıcı kararı
DEĞİL, aşağıda zaten karara bağlandı, bu yüzden "açık soru" sayılmıyor):
atdd.md'nin Benchmark bölümü "iki Supabase sorgusu Promise.all ile
paralel çalışır" diyor, ama kod keşfi gösteriyor ki bu TAM olarak
uygulanamaz — `listings` sorgusu, subscription sorgusunun sonucuna
(erişim kararına) bağımlı, iki sorgu birbirinden bağımsız değil.
Düzeltme: subscription'ın kendi iki alt-sorgusu (açık satır + 0 satırsa
fallback en-son-satır) zaten sıralı olmak ZORUNDA; erişim kararı
netleştikten SONRA, erişim varsa `listings` sorgusu çalıştırılır — burada
paralelleştirilecek bağımsız bir ikinci sorgu yok. Performans hedefi
pratikte "gereksiz sıralı await zinciri yok, sadece gerekli sorgular
çalışır" olarak karşılanıyor; atdd.md'nin `Promise.all` ifadesi literal
uygulanamaz ama ruhu korunuyor. Bu karar code-copilot'un prompt'una
aktarılıyor.

## Alan etiketleme
Tek dosya grubu: frontend (sayfa + test).
