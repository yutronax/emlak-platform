# Security Scan — supabase-proje-kurulumu

Kapsam: `scraper/scripts/verify_supabase.py`, `scraper/tests/test_verify_supabase.py`, `scraper/tests/conftest.py`, `.env.example`

| Gate | Sonuç | Detay |
|---|---|---|
| Secrets (detect-secrets) | PASS | Bulgu yok |
| Python SAST (bandit) | PASS | Bulgu yok |
| Python deps (pip-audit) | N/A | Taranan dosya kapsamında bağımlılık manifesti yok (scraper/requirements.txt bu görevde değişmedi, kapsam dışı tutuldu) |
| Node deps (npm audit) | N/A | package.json yok (bu görev Python/scraper tarafında) |

**Genel: PASS** (bilinen imzalarda bulgu yok — iş mantığı/yetkilendirme açıkları bu skill'in kapsamı dışında, `pm` adımında değerlendirilir).
