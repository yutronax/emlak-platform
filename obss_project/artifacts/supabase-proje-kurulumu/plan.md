# Plan — supabase-proje-kurulumu
_Reference: atdd.md_

Frontend-pipeline: tetikleyici yok (backend/altyapı-only görev — affected_modules'te .tsx/.css yok, Benchmark'ta Görsel/UI kriteri boş).

## Keşif bulguları (atdd.md'nin bilmediği)
- `supabase/` klasöründe sadece `migrations/` var — **`config.toml` yok**, yani proje hiç `supabase init` edilmemiş.
- `supabase` CLI makinede global kurulu değil, ama `npx supabase --version` çalışıyor (2.121.0) — kurulum gerekmiyor, tüm komutlar `npx supabase ...` ile çalıştırılacak.
- `.gitignore`'da `supabase/.temp/` yok — `supabase init`/`link` bu klasörü oluşturacak, commit'e girmemeli.
- `scraper/supabase_client.py` şu an `os.environ["SUPABASE_URL"]` gibi düz erişim yapıyor (KeyError, "placeholder" reddi yok) — ATDD bunu "opsiyonel iyileştirme" sayıyor, bu görevde DEĞİŞTİRİLMEYECEK (AC'lerin hiçbiri bunu zorunlu kılmıyor, kapsam dışına taşmamak için atlandı).
- AC-2/AC-3/AC-4 ("şema smoke check", "yaz-oku-sil", "RLS reddi") otomatikleştirilebilir bir doğrulama script'i gerektiriyor — repoda henüz yok, yeni dosya olarak eklenecek.

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| `.gitignore` | `supabase/.temp/` eklenmeli (link/init sonrası oluşur, commit'e girmemeli) | low | devops |
| `README.md` | Kurulum adımlarını gerçek proje linki + doğrulama script'ini çalıştırma talimatıyla güncelle | low | devops |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| `supabase/config.toml` (+ `supabase/` altında CLI'nin oluşturduğu diğer dosyalar) | `npx supabase init` çıktısı — proje CLI'ye bağlanabilsin diye zorunlu | devops |
| `scraper/scripts/verify_supabase.py` | AC-2 (şema smoke check: 6 tablo + is_admin + 2 RPC), AC-3 (service key ile yaz-oku-sil), AC-4 (anon key ile RLS reddi) — tek script, üç kontrolü de çalıştırıp PASS/FAIL raporlar | backend |

## Dependencies
- `scraper/supabase_client.py`'deki `get_client()` fonksiyonu `verify_supabase.py` tarafından çağrılacak (service-role client için).
- Anon-key testi için `web/src/lib/supabase/client.ts`'teki gibi `@supabase/supabase-js`'in Python karşılığı (`supabase-py`) anon key ile ayrıca bir client oluşturacak — `requirements.txt`'teki `supabase>=2.6.0` bağımlılığı yeterli, yeni paket gerekmiyor.

## Migration Required?
Hayır — `0001_init.sql` ve `0002_admin_review.sql` zaten yazılmış, bu görev sadece onları gerçek projeye `db push` ile uyguluyor. Yeni migration dosyası YOK.

## Risks
(atdd.md'den taşındı, ek yok)
- Service-role key yanlışlıkla `NEXT_PUBLIC_*`/commit'e girerse repo public olduğu için anında sızar.
- Yanlış key sessizce 0 satır dönebilir — `verify_supabase.py` bu yüzden yaz-oku-sil + hata kodu loglamalı, sessiz 0 kabul etmemeli.

## Open Questions
(atdd.md'nin Unknowns/Assumptions bölümünden taşındı — kod keşfi bunları çözmedi, kullanıcıya soruluyor)
1. Supabase hesabınız/projesi zaten var mı, yoksa şimdi dashboard'dan (supabase.com) yeni proje mi açacaksınız? **Ben bu adımı sizin adınıza yapamam** (hesap/proje oluşturma, dashboard login — güvenlik kısıtım) — bu adımı siz yapıp bana `project-ref` ve (gerekirse) DB şifresini vermeniz gerekiyor.
2. Proje bölgesi (region) tercihiniz var mı, yoksa `eu-central-1` (Frankfurt, Türkiye'ye en yakın) ile devam edelim mi?

## Kararlar
(kullanıcı yetkisiyle Opus low alt-ajanı tarafından yanıtlandı)
1. Mevcut proje varsayımı: "Henüz proje yok, kullanıcı şimdi supabase.com dashboard'dan ücretsiz katmanda yeni proje açacak" varsayımıyla ilerlenir. Gerekçe: AC-1'deki "boş/yeni proje" ifadesi ve happy path'in ilk adımı bunu varsayıyor; `config.toml` yokluğu da hiç bağlanılmadığını doğruluyor. Kullanıcı projeyi açtıktan sonra `project-ref` ve DB şifresini kendisi verir — ajan hesap/login işlemi yapmaz.
2. Bölge: `eu-central-1` (Frankfurt) ile devam edilir. Gerekçe: Türkiye'ye en yakın bölge, şema/AC'leri etkileyen bir kısıt yok; kullanıcı proje açarken başka bölge seçerse sadece `project-ref` değişir, akış aynı kalır.

## Alan Etiketleme Özeti
Tüm dosyalar `devops` veya `backend` — hiçbir `frontend` dosyası yok (frontend-pipeline tetiklenmedi, tutarlı).
