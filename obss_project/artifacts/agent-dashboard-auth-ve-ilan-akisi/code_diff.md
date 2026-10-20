# Code Diff — agent-dashboard-auth-ve-ilan-akisi

## Değiştirilen dosyalar
- `web/src/app/agent/dashboard/page.tsx` — tamamen yeniden yazıldı:
  `redirect("/login")` auth guard; açık abonelik sorgusu (trialing/active/
  past_due, en yeni) + 0 satırsa fallback en-son-satır sorgusu; rozet
  etiketleri (trialing/active/past_due/canceled + yok); erişim kararı
  (status active/trialing + current_period_end > now); erişim varsa
  `listings` sorgusu (order+limit 20) ve render; erişim yoksa CTA; erişim
  var + boş havuzda nötr mesaj.

## Acceptance Criteria karşılanma durumu (kod incelemesiyle doğrulandı)
| AC | Durum |
|---|---|
| AC-S1 (auth guard) | ✅ `redirect` ilk satırlarda, hiçbir sorgu ondan önce çalışmıyor |
| AC-S2 (RLS tek yetki kaynağı) | ✅ `createClient()` kullanılıyor, service-role yok, `listings`'e agent_id filtresi eklenmedi |
| AC-3 (açık abonelik rozeti) | ✅ |
| AC-4 (canceled) | ✅ fallback sorgu |
| AC-5 (abonelik yok) | ✅ |
| AC-6 (listings render) | ✅ order+limit(20) doğrulandı |
| AC-7 (erişim yok, CTA) | ✅ listings sorgusu koşullu (`if (hasAccess)`) |
| AC-8 (erişim var, boş havuz) | ✅ |

## Kalan sınırlamalar / Varsayımlar
- İki subscription sorgusu sıralı (plan.md'nin Open Questions düzeltmesiyle
  tutarlı) — `Promise.all` atdd.md'nin literal istediği gibi uygulanamadı,
  gerekçesi plan.md'de kayıtlı.
- Eski placeholder paragrafı ("Faz 4'te eklenecek") kaldırıldı, listings
  onun yerini aldı.
- Rozet metninden "Abonelik: " öneki kaldırıldı (test tam eşleşme
  istiyordu) — sadece bu sayfanın kendi `BADGE_LABELS`'ı, `account/
  subscription` sayfasının `STATUS_LABELS`'ından bağımsız (ayrı dosyalar,
  kasıtlı olarak paylaşılan bir sabit çıkarılmadı — CAVEMAN, iki sayfa
  farklı bağlamda farklı metin gösterebilir).
  **PM incelemesinde dikkat edilmesi gereken bir gözlem:** iki sayfa artık
  aynı durumlar için farklı Türkçe metinler kullanıyor (örn. bu sayfada
  "Ödeme gecikmiş", account/subscription'da "Gecikmiş") — tutarlılık
  sorunu olabilir, atdd.md'nin kapsamı bu tutarlılığı istemedi ama not
  edilmeye değer.
- atdd.md'de tanımlanmamış 2 ek durum eklendi (subscription/listings sorgu
  hatası) — mevcut `account/subscription/page.tsx` konvansiyonuyla tutarlı
  (sessiz başarı yerine açık hata mesajı), scope creep değil, CAVEMAN'ın
  "sessiz başarı yasak" ilkesine uygun savunmacı kod.

## CAVEMAN self-review
Yeni dosya/soyutlama yok — mevcut `page.tsx` dosyası içinde genişletildi,
mevcut `BADGE_LABELS`/`badgeLabel()` deseni korundu.
