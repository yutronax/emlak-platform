# Frontend Verify Report — admin-genel-bakis

**Durum: FRONTEND-PARTIAL** — üç ekran ve admin üst çubuğu mock servisle yazıldı, unit testlerle doğrulandı;
**tarayıcıda görülmedi** (admin alanı `admin/layout.tsx`'te admin oturumu ister; test hesabı yok).
Servis yokken `/admin`, `/admin/agents*` 404 ve üst çubukta yalnız İlanlar/Videolar görünür.

## Dosyalar
- `lib/admin-ui/{types,service}.ts`
- `components/admin/{labels,admin-overview,agents-view,agent-detail-view,clients}.tsx` (+admin-views testi, 12 test)
- `app/admin/page.tsx`, `app/admin/agents/page.tsx`, `app/admin/agents/[id]/page.tsx`
- `app/admin/layout.tsx`: admin kontrolünden sonra `AppHeader` (Yönetim bölümleri) — kontrol mantığı değişmedi
- `components/app-shell/app-header.tsx`: `sections` / `navLabel` / `homeHref` / `exact` prop'ları (varsayılanlar = emlakçı paneli)
- `app/admin/layout.test.tsx`: `next/navigation` mock'una `usePathname` eklendi

## Gate'ler
| Gate | Sonuç |
|---|---|
| Yeni/değişen testler | PASS — admin-views 12, app-header +1, admin layout 4 |
| Tüm testler | 1263/1265 — 2 hata `src/test/admin-video-rls.test.ts` |
| tsc / eslint | PASS |
| Build / tarayıcı | YAPILMADI |

### `admin-video-rls.test.ts` hakkında (bu görevle ilgisiz, dikkat)
Dosya uygulama kodu import etmiyor; doğrudan canlı Supabase'e `supabase-js` ile gidiyor. Başarısız iki test
(authz #3, #6) reddedilmesi beklenen INSERT'lerin 5 sn içinde yanıt vermemesi. Önceki turda tek başına 9/9
geçmişti, bu turda tek başına da 2 hata verdi → canlı DB/ağ gecikmesi. Ayrıca incelenmeli (bkz. kullanıcı özeti).

## Doğrulamak için
Admin hesabıyla giriş + `NEXT_PUBLIC_ADMIN_MOCK=1` → `/admin`. Mock: `a1` oturumdaki admin (kendi yetkisini
kaldıramaz), `a7` işlemleri hata döner, `a10` askıda.
