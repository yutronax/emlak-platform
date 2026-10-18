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

## agents-self-update-rls-yetki-yukseltme-acigi (2026-10-18, EML-18)

**Risk** (kaynak: atdd.md): Mevcut üretim verisinde açık daha önce istismar
edilmiş olabilir — `SELECT id, email, updated_at FROM agents WHERE is_admin
= true` ile salt-okunur bir denetim yapıldı, anormallik bildirilmedi (kullanıcı
beyanı, ayrıntılı satır çıktısı paylaşılmadı).

**Teknik karar** (kaynak: plan.md): `WITH CHECK` yerine BEFORE UPDATE trigger
seçildi — `WITH CHECK`'te OLD satırına (önceki `is_admin` değerine) doğrudan
referans yok, subquery ile aynı tabloyu okumak MVCC/command-counter
davranışına bağımlı güvenilmez bir varsayım olurdu; trigger'da `OLD`/`NEW`
açıkça mevcut.

**Kalan sınırlamalar / varsayımlar** (kaynak: code_diff.md, red_team.json):
- AC-2 (`id`/`created_at` alanlarının değişmezliği) için trigger'da açık bir
  koruma yok, bağımsız bir test de yazılmadı — dolaylı/doğrulanmamış bir
  güvenceye dayanıyor (PM bulgusu, medium, sonraya bırakıldı — kullanıcı
  onayıyla).
- Migration, Supabase Dashboard SQL Editor'den elle uygulandı — dosya ile
  gerçek proje şeması arasında otomatik bir senkronizasyon/diff kontrolü yok.

**Süreç notu** (kaynak: red_team.json compliance_check): Pipeline sırasında
iki küçük kapsam kararı orkestratör tarafından kullanıcıya sorulmadan alındı
(frontend-pipeline adımının `page.tsx`'in bu göreve dokunmadığı gerekçesiyle
atlanması; bir testin yanlış beklentisi düzeltilirken atdd.md'nin Davranış
Sözleşmesi'nin de güncellenmesi) — PM ikisini de teknik olarak doğru ama
şeffaflık notu gerektiren kararlar olarak işaretledi, kullanıcı commit
onayında bilgilendirildi.

**Gerçek canlı doğrulama** (kaynak: verify_report.md): Migration gerçek
Supabase projesine (ref: `bbjmjzixcugdwbcwydux`) uygulandı,
`web/src/test/agents-self-update-rls.test.ts` gerçek projeye karşı 6/6 PASS
— `is_admin` yetki yükseltme denemesi 403 + Postgres 42501 ile reddediliyor.
