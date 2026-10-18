# Test Diff — eml-20-scraper-webhook-auth

## Oluşturulan dosyalar
- `scraper/tests/test_webhook_auth.py` (yeni, `emlak-platform-backend-copilot`
  session'ı tarafından yazıldı — Jira subtask EML-28)

## AC → Test eşlemesi
| AC | Test fonksiyonu |
|---|---|
| AC-1 (happy path) | `test_ac1_valid_token_and_valid_json_returns_200_and_queues_payload` |
| AC-S1 (token eksik) | `test_ac_s1_missing_authorization_header_returns_401` |
| AC-S1 (token yanlış) | `test_ac_s1_wrong_token_returns_401` |
| AC-S1 (oracle yok) | `test_ac_s1_missing_and_wrong_token_give_identical_status_and_body` |
| AC-S2 (compare_digest çağrılıyor) | `test_ac_s2_token_comparison_uses_hmac_compare_digest` |
| AC-S2 (timing leak yok) | `test_ac_s2_timing_does_not_leak_correct_vs_incorrect_token` |
| AC-S3/S4 (auth → JSON parse'tan önce, token yok) | `test_ac_s3_s4_invalid_json_with_missing_token_returns_401_not_400` |
| AC-S3/S4 (auth → JSON parse'tan önce, token yanlış) | `test_ac_s3_s4_invalid_json_with_wrong_token_returns_401_not_400` |
| AC-8 (path kontrolü önce) | `test_ac8_wrong_path_returns_404_regardless_of_auth` |
| AC-9 (token doğru + JSON geçersiz) | `test_ac9_valid_token_with_invalid_json_returns_400` |
| AC-S5 (secret yok → fail-closed) | `test_ac_s5_run_without_secret_env_exits_before_starting_server` |
| AC-S5 (secret boş → fail-closed) | `test_ac_s5_run_with_empty_secret_env_exits_before_starting_server` |
| AC-7 (varsayılan host 127.0.0.1) | `test_ac7_default_bind_host_is_127_0_0_1` |
| AC-7 (özel host env'den) | `test_ac7_custom_bind_host_is_used_when_env_set` |

## Red step doğrulandı
Alt-ajanın raporu: mevcut (değişmemiş) `orchestrator.py`'ye karşı 9 test
FAIL (AC-S1 x3, AC-S2 compare_digest-çağrı kontrolü, AC-S3/S4 x2, AC-S5 x2,
AC-7 varsayılan-host), 5 test PASS (AC-1, AC-8, AC-9, AC-S2 timing, AC-7
özel-host — bunlar mevcut davranışla zaten örtüşüyor). Beklenen red-step
durumu bu.

## Change-log
Yok — henüz implementasyon yapılmadı, sözleşme değişikliği yok.
