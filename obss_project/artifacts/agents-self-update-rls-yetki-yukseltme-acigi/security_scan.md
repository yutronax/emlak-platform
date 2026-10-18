# Security Scan — agents-self-update-rls-yetki-yukseltme-acigi

Kapsam: `supabase/migrations/0004_fix_agents_self_update_rls.sql`,
`web/src/test/agents-self-update-rls.test.ts`

| Gate | Sonuç | Gerekçe |
|---|---|---|
| secrets (detect-secrets) | PASS | Bulgu yok |
| python_sast (bandit) | N/A | Değişen Python dosyası yok |
| python_deps (pip-audit) | N/A | Python bağımlılık manifesti yok |
| node_deps (npm audit) | N/A | Tarama proje kökünden çalıştırıldı, `package.json` `web/` altında — bu scope'ta anlamlı değil, ayrıca değişiklik yeni bir npm bağımlılığı eklemiyor |

Verdict: PASS (bilinen imzalarda bulgu yok). JS/TS iş mantığı açıkları için
SAST yok — bu kapsamda zaten `red-team`/`pm` incelemesi + `threat-model`'in
ürettiği AC-S'ler asıl güvenceyi sağlıyor.
