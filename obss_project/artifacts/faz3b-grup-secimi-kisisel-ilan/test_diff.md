# test_diff — faz3b-grup-secimi-kisisel-ilan (red)

| Dosya | Hedef AC |
|---|---|
| scraper/sidecar/sessions/groups.test.js (yeni) | AC-1, AC-5, AC-S4, AC-S7; sözleşme sidecar satır 5-6 |
| scraper/tests/test_personal_ingest.py (yeni) | AC-3, AC-6, AC-7, AC-11, AC-S3, AC-S4; sözleşme sidecar satır 1-4, 7-10 |
| scraper/scripts/verify_faz3b.py (yeni, canlı) | AC-S1, AC-S2, AC-S5, AC-S6 (iki emlakçı JWT'si gerekir) |
| web/src/app/agent/whatsapp/group-picker.test.tsx (yeni) | AC-1, AC-2, AC-10; get/set sözleşmesi UI satırları |
| web/src/app/agent/dashboard/feed-filters.test.tsx (yeni) | AC-8 (`kapsam=mine`) |
| web/src/app/agent/dashboard/listing-card.test.tsx (ek) | AC-8 rozet |
| web/src/app/admin/listings/page.test.tsx (ek) | AC-6 etiket |
| web/src/app/admin/listings/threshold-form.test.tsx (yeni) | AC-7, AC-S5 UI |

## Implementasyonun uyması gereken arayüz varsayımları
- groups.js: `classifyIncoming`, `capGroups(…,500)`, `createCounters`, `bump`, `toGroupRows`.
- orchestrator.handle_message sayaç anahtarını döndürür; `ingest_personal_listing(client, agent_id, record)` → `"approved"|"pending"|"duplicate"`; RPC parametreleri `p_agent_id`, `p_record`; `get_threshold(client)` → `(value, fallback)`.
- `admin_set_threshold(p_threshold)`; feed form alanı `kapsam=mine` → `p_filters.scope='mine'`.
- GroupPicker/ThresholdForm named export; metinler atdd'deki gibi tam.

## Test boşlukları (bilinçli)
- AC-2/AC-9/AC-10/AC-S8 DB RPC birim testi yok; AC-S1/S2 canlı betikle. Admin JWT gerektiren `invalid_value` ve approve owner koruması, push cron owner filtresi → verify/red-team'de elle kontrol.
