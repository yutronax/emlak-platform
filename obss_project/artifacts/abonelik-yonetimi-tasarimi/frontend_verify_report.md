# Frontend Verify Report — abonelik-yonetimi-tasarimi

**Durum: FRONTEND-READY / MOCKED** — yeni tasarım yalnız `NEXT_PUBLIC_BILLING_MOCK=1` (dev) iken; bayraksız
`/account/subscription` mevcut sunucu sürümüyle aynen çalışır (12 eski test regresyonsuz geçti).
Mock durum seçimi: `?durum=active|trialing|past_due|pending|needs_review|failed|canceled|none`.

## Değişenler
- `lib/billing-ui/{types,mock-service,service}.ts`
- `app/account/subscription/{billing-view,billing-client}.tsx`; `page.tsx` başına mock dalı (geri uyumlu opsiyonel prop)
- `components/ui/confirm-dialog.tsx` (yeni, ortak); `components/ui/button.tsx`'e `ref` prop'u

## Gate'ler
| Gate | Sonuç |
|---|---|
| Yeni testler | PASS — billing-view 22, service 12 |
| Tüm testler | PASS — 92 dosya / 1183 test |
| tsc / eslint | PASS |
| Build | ÇALIŞTIRILMADI |

## Tarayıcı [Browser pane, mock]
| Viewport | Senaryo | Sonuç |
|---|---|---|
| 1440×900 | active | taşma yok; mevcut plan, 3 plan kartı (Pro işaretli), ödeme tablosu |
| 390×844* | past_due | sayfa taşmıyor (sw = vw); ödeme uyarısı ilk ekranda; tablo kendi kabında kayıyor (560/357) |
| 390×844* | iptal penceresi | açılınca odak "Vazgeç", görünür alanda; Esc kapatır, odak tetikleyiciye döner |
| 768×1024 | none | taşma yok; boş durum + 3 "Planı seç" |
\* Emülasyon bu ölçümde iç genişliği 558 bildirdi (pane ölçekleme); karşılaştırma aynı değerle yapıldı.

Bu sayfalarda tüm istekler 200. Konsoldaki `ERR_CONNECTION_RESET`/RSC hataları sunucu yeniden başlatılırken
yapılan bir `/agent/whatsapp` gezinmesine ait. `vision-test` çalıştırılmadı.
