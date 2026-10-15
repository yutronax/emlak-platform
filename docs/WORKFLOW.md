# Ekip İş Akışı

4 kişilik ekip (2 yazılımcı, 1 editör, 1 kameraman) arasındaki devir noktaları.

```mermaid
flowchart LR
    subgraph Saha
        KAM["Kameraman: ev cekimi"]
        EDI["Editor: video kurgu"]
    end
    subgraph Yazilim
        DEV1["Gelistirici 1: scraper/backend"]
        DEV2["Gelistirici 2: web/frontend"]
    end

    KAM --> EDI
    EDI -- "bitmis video dosyasi" --> DEV2
    DEV1 -- "raw_listings verisi" --> DEV2
    DEV2 -- "onay/red" --> ADMIN["Admin paneli"]
    ADMIN -- "yayinlanan ilan/video" --> AGENT["Emlakci paneli"]
```

**Devir noktaları**
- Kameraman → Editör: ham çekim dosyası (format/süre standardı ekip içinde kararlaştırılmalı).
- Editör → Geliştirici 2: bitmiş video dosyası + hangi mülke ait olduğu bilgisi (Faz 5'te `/admin/videos` üzerinden yükleme akışı kurulacak).
- Geliştirici 1 → Geliştirici 2: `raw_listings` tablosu arayüzü (scraper backend yazar, web admin paneli okur) — ortak sözleşme şema dosyasında (`supabase/migrations/`).
- Admin paneli → Emlakçı paneli: sadece onaylanmış, abonelik kontrolünden geçen veri.

Görev kırılımı ve kimin hangi fazda ne yapacağı bu dosyada değil, ekibin kendi task panosunda (bkz. proje notları) tutulur — mimari burada sabit, iş dağılımı orada değişken.
