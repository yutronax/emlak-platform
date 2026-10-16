# AI Dev Log

Pipeline adımlarının (atdd/plan/code_diff/verify) kendi dosyalarına yazdığı
karar/risk/varsayım kayıtlarının aktarımı — yeniden yorumlanmadan, kaynağıyla.

## supabase-proje-kurulumu (2026-10-16)

**Riskler** (kaynak: atdd.md, plan.md):
- Service-role key yanlışlıkla `NEXT_PUBLIC_*`'e veya commit'e girerse, repo
  public olduğu için anında sızar — tek çözüm key'i Supabase dashboard'dan
  rotate etmek (geçmişten silmek yetmez).
- Yanlış key (ANON yerine SERVICE_ROLE beklenen yerde) sessizce 0 satır
  dönebilir, fark edilmeyebilir — bu yüzden `verify_supabase.py` yaz-oku-sil
  smoke testi zorunlu tutuldu.

**Kararlar** (kaynak: plan.md, kullanıcı yetkisiyle Opus alt-ajanı tarafından yanıtlandı):
- Supabase bölgesi: `eu-central-1` (Frankfurt) — Türkiye'ye en yakın, şema/AC'leri
  etkileyen bir kısıt yoktu.
- "Henüz proje yok, kullanıcı şimdi dashboard'dan yeni proje açacak" varsayımıyla
  ilerlendi — doğrulandı, kullanıcı gerçekten yeni proje açtı.

**Kalan sınırlamalar / varsayımlar** (kaynak: code_diff.md):
- `verify_supabase.py`'nin RPC varlık kontrolü, migration'daki Türkçe RAISE
  EXCEPTION metnini ("bulunamadı") kanıt olarak kullanıyor — mesaj metni
  değişirse sessizce FAIL'e döner (fail-safe yönde, ama kırılgan). PM
  incelemesinde düşük risk olarak not edildi, düzeltilmedi (bilinçli kabul).
- `SUPABASE_ANON_KEY` env değişken adı code-copilot tarafından seçildi
  (kullanıcıya sorulmadan) — makul ama şeffaflık notu olarak kayıtlı.
- Anon ile yanlışlıkla başarılı insert olursa (RLS atlanmışsa) script
  temizlik yapamaz (silme de RLS'e takılır) — atdd.md'de zaten bilinen ve
  kabul edilmiş bir sınırlama.

**Not — SETUP.md oluşturulmadı:** Bu projede kurulum adımları zaten
`README.md`'de tutuluyor (ayrı bir `SETUP.md` dosyası yok, iki kaynağa
bölünmesi gereksiz tekrar yaratırdı) — plan.md'nin öngördüğü env
değişkeni/doğrulama script'i adımı bu görevde doğrudan README.md'ye eklendi.

**Gerçek canlı doğrulama** (kaynak: verify_report.md): Gerçek Supabase
projesi (ref: `bbjmjzixcugdwbcwydux`) bağlandı, migration'lar uygulandı,
`python -m scripts.verify_supabase` canlı projede çalıştırıldı — `GENEL: PASS`.
