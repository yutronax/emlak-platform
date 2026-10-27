# Plan — musteri-sayfalari-tasarim-yenileme
_Reference: atdd.md, design-direction.md_

Frontend-pipeline: tetikleyici VAR, zaten çalıştırıldı. Discover (gerçek tarayıcıda
mevcut hal doğrulandı — tamamen varsayılan, title bile "Create Next App") ve
Design Direction (`design-direction.md` — tam token sistemi, layout konseptleri,
WCAG AA kontrast doğrulaması) tamamlandı, bu plan onları girdi olarak kullanıyor.

## Keşif Sonucu (gerçek koddan — atdd.md'nin Unknown'ını çözüyor)

1. **Route group mekanizması DOĞRULANDI** (`node_modules/next/dist/docs/01-app/
   03-api-reference/03-file-conventions/route-groups.md`): `(folderName)` sözdizimi
   URL'e yansımıyor. **Kritik karar:** YENİ bir root layout AÇILMAYACAK (bu, farklı
   route group'lar arası geçişte tam sayfa yeniden yüklemesi — "full page reload
   caveat" — tetikler, admin/agent'tan marketing'e geçişte istenmeyen bir davranış
   olurdu). Bunun yerine mevcut `src/app/layout.tsx` (root, html/body/font sarmalayıcı)
   AYNEN KALIYOR, SADECE `src/app/(marketing)/layout.tsx` adında NESTED (iç içe,
   root OLMAYAN) bir layout eklenecek — bu, dokümantasyonun "opt specific route
   segments into sharing a layout, while keeping others out" kullanım örneğiyle
   birebir örtüşüyor.
2. **4 sayfa TAŞINACAK:** `src/app/page.tsx` → `src/app/(marketing)/page.tsx`,
   `src/app/pricing/` → `src/app/(marketing)/pricing/` (buy-button.tsx dahil),
   `src/app/login/` → `src/app/(marketing)/login/` (actions.ts dahil),
   `src/app/signup/` → `src/app/(marketing)/signup/` (actions.ts dahil). URL'ler
   DEĞİŞMİYOR (`/`, `/pricing`, `/login`, `/signup` aynen kalıyor — route group
   parantezli klasör adı URL'e yansımaz).
3. **`next/font/google`'da `Sora` ve `Inter` DOĞRULANDI** (`node_modules/next/
   dist/compiled/@next/font/dist/google/font-data.json`'da ikisi de mevcut).
   Mevcut `layout.tsx`'teki `Geist`/`Geist_Mono` deseni AYNI şekilde kullanılacak:
   `import { Sora, Inter } from "next/font/google"`, CSS değişkenleri
   (`--font-sora`, `--font-inter`) tanımlanacak.
4. **`globals.css`'teki dark-mode riski bulundu ve çözüldü:** Mevcut
   `@media (prefers-color-scheme: dark)` bloğu `--background`/`--foreground`'u
   OS tercihine göre değiştiriyor — bu, atdd.md'nin "dark mode kapsam dışı"
   kararıyla ÇELİŞİR (bir OS'u karanlık modda olan ziyaretçi yeni tasarımı hiç
   göremez). **Karar:** Marketing sayfaları kendi zemin/metin rengini (design-
   direction.md'nin `fog-50`/`ink-900` token'ları) EXPLICIT Tailwind class'larıyla
   (`bg-[#F5F6F4] text-[#10253F]` veya Tailwind tema token'ı) ayarlayacak, body'nin
   miras aldığı `var(--background)`'a GÜVENMEYECEK — bu şekilde admin/agent
   sayfalarının mevcut dark-mode davranışı BOZULMADAN, marketing sayfaları OS
   tercihinden bağımsız sabit-açık kalır.
5. **Yeni component'ler için konvansiyon DOĞRULANDI:** Proje `src/components`
   dizinini henüz kullanmıyor (ilk kez bu görevle açılıyor), dosya adlandırması
   kebab-case (`src/app/pricing/buy-button.tsx` emsali) — yeni dosyalar da
   `site-header.tsx`, `site-footer.tsx`, `ui/button.tsx`, `ui/alert.tsx` olarak
   aynı konvansiyonu takip edecek.
6. **Tailwind v4 teması:** `globals.css`'teki `@theme inline` bloğuna design-
   direction.md'nin token'ları (`--color-ink-900`, `--color-fog-50`, `--color-
   terracotta-600`, `--color-terracotta-700`, `--color-slate-500`, `--color-
   mist-200`, `--color-moss-700`, `--color-brick-700`) eklenecek — bu, kodda
   hardcoded hex yerine `bg-ink-900`/`text-terracotta-700` gibi Tailwind
   class'ları kullanılabilmesini sağlar (atdd.md'nin "hardcoded hex YOK" AC'si).

## Files to Modify (taşınacak + yeniden yazılacak)
| File | Why | Risk | Alan |
|------|-----|------|------|
| `web/src/app/layout.tsx` | Font importu Geist→Sora/Inter, metadata güncelleme (title/description) | low | frontend |
| `web/src/app/globals.css` | Token sistemi eklenir (`@theme inline`), dark-mode media query'si admin/agent için KALIR ama marketing kendi explicit class'larını kullanacağı için etkilenmez | low | frontend |

## New Files (taşıma + yeni component'ler)
| File | Purpose | Alan |
|------|---------|------|
| `web/src/app/(marketing)/layout.tsx` | SiteHeader+children+SiteFooter sarmalayıcı, SADECE bu 4 sayfaya | frontend |
| `web/src/app/(marketing)/page.tsx` | Landing (eski `src/app/page.tsx`'ten taşınan+yeniden tasarlanan) | frontend |
| `web/src/app/(marketing)/pricing/page.tsx` + `buy-button.tsx` | Pricing (taşınan, buy-button mantığı DEĞİŞMEDEN) | frontend |
| `web/src/app/(marketing)/login/page.tsx` + `actions.ts` | Login (taşınan, actions mantığı DEĞİŞMEDEN) | frontend |
| `web/src/app/(marketing)/signup/page.tsx` + `actions.ts` | Signup (taşınan, actions mantığı DEĞİŞMEDEN) | frontend |
| `web/src/components/site-header.tsx` | Ortak header (logo, Fiyatlar/Giriş linkleri, Kayıt Ol CTA) | frontend |
| `web/src/components/site-footer.tsx` | Ortak footer | frontend |
| `web/src/components/ui/button.tsx` | Birincil/ikincil varyant, `isPending`/`aria-busy` desteği | frontend |
| `web/src/components/ui/alert.tsx` | `role="alert"`/`role="status"` varyantları (hata/başarı) | frontend |

## Silinecek (taşıma sonrası eski konum)
`web/src/app/page.tsx`, `web/src/app/pricing/`, `web/src/app/login/`, `web/src/app/signup/` — içerikleri `(marketing)/` altına taşındıktan sonra eski dosyalar silinir (aynı anda iki kopya kalmaz, aksi halde route çakışması/kafa karışıklığı olur).

## Dependencies
- Mevcut `login`/`signup` server action'ları (`actions.ts`) ve `BuyButton` mantığı — SADECE dosya konumu değişiyor (taşıma), içerik/davranış DEĞİŞMİYOR.
- `@/lib/supabase/server`, `@/lib/auth/requireAdmin` gibi mevcut import'lar — taşınan dosyalarda import path'leri (`@/...` alias) DEĞİŞMEZ çünkü Next.js path alias'ları `src/` köküne göre çözülüyor, klasör taşıma bunu etkilemiyor.

## Migration Required?
Hayır — bu görev saf frontend, DB/Supabase şeması değişmiyor.

## Risks
atdd.md'den taşınan riskler (route group/admin-agent izolasyonu, CLS, kontrast) — hepsi yukarıdaki keşifle ÇÖZÜLDÜ/doğrulandı. **Yeni risk (keşifte bulundu):** Dosya taşıma işlemi (4 sayfa + ilişkili `actions.ts`/`buy-button.tsx`) mekanik ama dikkatli yapılmalı — eski ve yeni konumda aynı anda dosya kalırsa Next.js "conflicting paths" hatası verir (dokümantasyonda da uyarılmış). `code-copilot` dispatch'i YENİ dosyaları yazdıktan hemen sonra ESKİ dosyaları silmeli, ayrı adımlar olarak bırakmamalı.

## Open Questions
Yok — atdd.md'nin tek Unknown'ı (route group sentaksı) bu adımda çözüldü. Design Direction zaten ayrı bir adımda (frontend-pipeline) netleşmişti.

## Alan Etiketleri
Tüm dosyalar `frontend` — bu görevde backend/devops dosyası yok.

## test-copilot / code-copilot Dispatch Talimatı (somut)
**Frontend grubu (tek grup):**
1. `globals.css`'e design-direction.md'nin 8 token'ını `@theme inline` bloğuna ekle (`--color-ink-900: #10253F` vb., birebir design-direction.md'deki tablo).
2. `layout.tsx`'te `Geist`/`Geist_Mono` → `Sora`/`Inter` (`next/font/google`'dan, mevcut `variable` deseniyle), `metadata` güncelle (title: "Emlak Platformu" gibi anlamlı bir başlık, "Create Next App" KALMAYACAK).
3. `src/components/ui/button.tsx`: birincil (terracotta-600 zemin, beyaz metin) / ikincil (ink-900 border, ink-900 metin) varyantlı, `disabled`/`aria-busy` destekli.
4. `src/components/ui/alert.tsx`: `variant: "error"|"success"`, `role="alert"`/`role="status"` otomatik, brick-700/moss-700 renkleri.
5. `src/components/site-header.tsx`, `site-footer.tsx`: design-direction.md'nin wireframe'ine göre.
6. `src/app/(marketing)/layout.tsx`: `<SiteHeader/>{children}<SiteFooter/>`.
7. 4 sayfayı YENİ konuma TAŞI (içerik yeniden yazılır, design-direction.md'nin wireframe'lerine göre — landing'e hero+2 CTA+3 madde şeridi, pricing'e asimetrik Pro-vurgulu kart, login/signup'a split panel+gerçek `<label>`+yeni Alert/Button component'leri) VE eski konumdaki dosyaları SİL.
8. Server action'ların (`login`/`signup` actions.ts, BuyButton'ın kendi mantığı) İÇERİĞİNE DOKUNMA — sadece dosya konumu taşınıyor.

Testler: Playwright multi-viewport (375/768/1280px) + axe erişilebilirlik taraması, `verify` adımında koşulacak (bu görev için unit/integration testleri `ui/button`/`ui/alert` component'lerinin render/aria durumlarını kapsar).
