# Frontend Verify Report — video-vitrin

**Durum: FRONTEND-READY / MOCKED** — `/vitrin`, `/vitrin/[id]` ve ana sayfa önizlemesi mock servisle
(`NEXT_PUBLIC_SHOWCASE_MOCK=1`, yalnız dev). Servis yokken `/vitrin*` 404, önizleme gizli.

## Dosyalar
- `lib/showcase-ui/{types,filters,format,mock-service,service}.ts` (+3 test dosyası)
- `components/showcase/{showcase-card,showcase-preview}.tsx` (+test)
- `app/(marketing)/vitrin/{page,showcase-client,showcase-view}.tsx` (+test), `vitrin/[id]/{page,showcase-detail}.tsx` (+test)
- `app/(marketing)/page.tsx`: "İlanınıza reklam videosu" bölümünden sonra `<ShowcasePreview />`
- `app/(marketing)/page.test.tsx`: async önizleme bileşeni mock'landı (istemci render'ında askıya alınıyordu)

## Gate'ler
| Gate | Sonuç |
|---|---|
| Yeni testler | PASS |
| Tüm testler | PASS — 100 dosya / 1230 test |
| tsc / eslint | PASS |
| Build | ÇALIŞTIRILMADI |

## Tarayıcı
| Viewport | Sayfa | Sonuç |
|---|---|---|
| 1440×900 | /vitrin | 14 ilan, 6 kart, 3 sütun, taşma yok |
| 1440×900 | /vitrin/a1 | sekme başlığı ilan adı; WhatsApp bağlantısı encode'lu; 3 benzer ilan |
| 1440×900 | / | "Vitrinde yayında" bölümü, 3 kart |
| 390×844 | /vitrin?islem=kiralik&sehir=İzmir | "Filtreler (2)", panel kapalı, ilk kart 457px (ilk ekran), 3 kart hepsi kiralık, taşma yok |
| 390×844 | /vitrin/olmayan-ilan | marka 404 |
| 768×1024 | /vitrin | 2 sütun, taşma yok |
Sunucu logunda hata yok. `vision-test` çalıştırılmadı.

## Bilinçli kararlar
- Poster yokken CSS zemin + ilçe adı; gerçek poster gelince `<img>`.
- Emlakçı telefonu detayda açık gösteriliyor — KVKK/emlakçı onayı backend sorusu (#2).
