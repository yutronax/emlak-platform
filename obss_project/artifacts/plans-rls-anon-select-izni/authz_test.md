# Authz Test Matrisi — plans-rls-anon-select-izni

Jira: EML-68

## Not — standart IDOR matrisinden farkı
`plans` tablosu kullanıcıya/kiracıya ait değil (sahiplik yok, herkese açık
fiyat planı verisi). Bu yüzden klasik "A sahibi / B başkası" matrisi burada
anlamsız — gerçek risk ekseni **okuma mı yazma mı** ve **hangi rol ne
yapabiliyor**. Matris buna göre uyarlandı.

## Test Matrisi

| # | Aktör | İşlem | Beklenen | AC |
|---|---|---|---|---|
| 1 | `anon` key | SELECT | 200 + service_role ile sayılan satır sayısına eşit sonuç (şu an 3) | AC-1 |
| 2 | `authenticated` kullanıcı | SELECT | 200 + aynı satır sayısı (regresyon — mevcut davranış bozulmamalı) | AC-1 |
| 3 | `anon` key | INSERT | 401/403 (42501 RLS ihlali) — tablo içeriği değişmemiş olmalı (yazma sonrası service_role ile satır sayısı tekrar kontrol edilir) | AC-S1 |
| 4 | `anon` key | UPDATE | 200/204 dönse bile **0 satır etkilenmeli** — yanıt kodu yetmez, güncelleme sonrası veri tekrar okunup değişmediği doğrulanır | AC-S1 |
| 5 | `anon` key | DELETE | 200/204 dönse bile **0 satır etkilenmeli** — aynı doğrulama | AC-S1 |
| 6 | — (statik) | `pg_policies` sorgusu | `plans` için SELECT policy rolleri `{anon, authenticated}` içerir; `anon` için `INSERT`/`UPDATE`/`DELETE`/`ALL` cmd'li başka policy YOK | AC-S2 |
| 7 | — (statik, migration öncesi) | `plans` tablosunun sütun listesi | Hassas görünen bir sütun (örn. `cost_basis`, `internal_notes`, `margin`) varsa bu adım bloke eder ve kullanıcıya sorulur | AC-S3 |

## İki kural — bu görevde nasıl uygulandı
- **Boş liste geçmek değildir:** Satır 1-2'de `200 + []` görülürse bu PASS
  sayılmaz — test, tablonun gerçekten dolu olduğunu (service_role ile önceden
  sayarak) bilmeli; anon'un döndürdüğü sayı o sayıyla eşleşmeli. Aksi halde
  RLS'in sessizce filtrelediği mi yoksa veri mi yok ayırt edilemez.
- **Yazma testinde son durumu doğrula:** Satır 4-5'te sadece HTTP durum koduna
  bakmak yetmez — `403` dönüp veriyi değiştiren bir uç olabilir. Test,
  işlemden sonra service_role ile veriyi tekrar okuyup değişmediğini
  kanıtlamalı.

## Mock kuralı
Bu testlerin TÜMÜ gerçek Supabase projesine (test/dev ortamı, kullanıcının
kendi projesi) karşı integration testi olarak yazılmalı — mock'lanmış bir
Supabase client authz testini kanıtlamaz, FAIL sayılır. `test-copilot`'a
dispatch edilirken bu kural `extra_instructions` olarak aktarılacak.

## Canlı sonda
Henüz migration yazılmadı (bu adım sadece matris/strateji netleştirme). Canlı
sonda, `code-copilot` migration'ı uyguladıktan ve `supabase-check` gate'i
geçtikten SONRA, `verify` adımında koşulacak — kullanıcının kendi Supabase
projesinde (üretim değil, zaten tek proje bu — kullanıcı onayı gerekir).

## Kapsanmayan
- Satır 2 ("başka kullanıcı B") klasik IDOR anlamında N/A — `plans`'ta
  sahiplik yok, bu yüzden "authenticated kullanıcı" satırı (2) regresyon
  amaçlı, IDOR amaçlı değil.
- Rol yükseltme denemesi (istekte `role: admin`) N/A — bu bir REST tablo
  sorgusu, body'den role okunmuyor.
