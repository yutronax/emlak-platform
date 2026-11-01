# Frontend Contract — durum-ekranlari (404 · hata · yükleme)

> Kaynak: sayfa listesi #4–6; "önce tasarımlar". Servis/veri yok — yalnız UI. atdd.md yok.
> Next 16 kuralları `node_modules/next/dist/docs`'tan okundu: `error.js` client, `{ error: unknown, retry }`
> (`retry` 16.2'de eklendi, `reset` yerine önerilen); `global-error` kendi `<html>/<body>`'sini ve stillerini taşır;
> kök `not-found` eşleşmeyen tüm URL'leri ve `notFound()` çağrılarını karşılar, metadata destekler.

## Tasarım
- 404 ve hata ekranları giriş/kayıt ile aynı marka sahnesi: `ink-900` zemin, CSS ızgara dokusu, arka planda soluk büyük
  kod ("404"); önde tek kart değil, sola hizalı kısa metin + iki aksiyon. Dekor `aria-hidden`, img/svg yok.
- Yükleme: panel (`agent/`, `account/`) ve `admin/` için içerik iskeleti (başlık + 3 kart çizgisi), `aria-busy`,
  ekran okuyucuya "Yükleniyor…"; `prefers-reduced-motion`'da nabız animasyonu kapalı.

## Ekranlar
| Dosya | Başlık | Metin | Aksiyonlar |
|---|---|---|---|
| `app/not-found.tsx` | Bu sayfa bulunamadı | Bağlantı eskimiş ya da adres yanlış yazılmış olabilir. | **Ana sayfa** (/) · Panele git |
| `app/error.tsx` | Bir şeyler ters gitti | Sayfa yüklenirken beklenmeyen bir sorun oluştu… | **Tekrar dene** (`retry`) · Ana sayfa · WhatsApp destek |
| `app/global-error.tsx` | (aynı) | (aynı) — kök layout çöktüğünde | **Tekrar dene** · Ana sayfa |
| `agent|account|admin/loading.tsx` | — | iskelet | — |

- Hata ekranı `error.digest` varsa "Hata kodu: …" gösterir (destek için; mesaj gösterilmez — production'da zaten genel).
- 404 metni kaynağın varlığını sızdırmaz (admin `notFound()` da buraya düşer).

## Görsel kabul kriterleri
- V-1: 1440/768/390'da taşma yok; birincil aksiyon ilk ekranda.
- V-2: Hata ekranında odak başlığa taşınır (ekran okuyucu ne olduğunu duyar).
- V-3: Dekor ekran okuyucudan gizli.
