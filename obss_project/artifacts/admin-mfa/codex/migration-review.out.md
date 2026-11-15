{
  "task": "admin-mfa-migration",
  "summary": "Altı tablonun restrictive politikası doğru: mevcut izinlere AND uygulanır; admin olmayan aal1 kullanıcıların mevcut erişimi korunur, admin aal1 kendi satırları dahil bu tablolardan kesilir. Dört RPC'nin davranışı MFA kontrolü dışında korunmuş; ancak feed RPC'leri kabul edilen engellemeyi atlıyor ve rollback tekrar çalıştırılabilir değil. İnceleme dosyalar üzerinde salt okunur yapıldı; canlı SQL yürütülmedi.",
  "findings": [
    {
      "severity": "high",
      "category": "security",
      "file": "supabase/migrations/0033_admin_mfa.sql; supabase/migrations/0024_wa_groups_personal_listings.sql:196; supabase/migrations/0027_agent_suspension.sql:9",
      "issue": "SECURITY DEFINER feed_listings, feed_filter_options ve feed_unread_count MFA kontrolü olmadan listings okuyor. Somut karşı örnek: askıda olmayan, geçerli aboneliği ve kişisel ilanı bulunan admin, aal1 JWT ile feed_listings('{\"scope\":\"mine\"}',1) çağırdığında kendi ilanını okuyabilir. Üç RPC authenticated'a açık; ortak feed_access yalnız askı ve aboneliği denetliyor. Tabloya eklenen restrictive politika bu definer okumasını engellemez.",
      "better_approach": "Ortak feed_access kapısında admin ve aal1 birleşimini reddet; bu kontrolün üç RPC'yi de kapsadığını doğrula. Admin olmayan abonelerin mevcut davranışını koru.",
      "reason": "Kullanıcının kabul ettiği 'admin aal1 kendi emlakçı verisinden de kesilir' sözleşmesi doğrudan RPC üzerinden ihlal ediliyor. Bu yol bütün admin verisini açmaz; abonelik kapsamındaki ortak ve kişisel ilanlara erişim bırakır."
    },
    {
      "severity": "medium",
      "category": "reliability",
      "file": "supabase/rollback/0033_admin_mfa_rollback.sql",
      "issue": "Rollback idempotent değil: son bölümde REVOKE ALL ON FUNCTION public.session_is_aal2() ve is_admin_user() koşulsuz çalışıyor. İlk başarılı rollback fonksiyonları düşürdüğünden ikinci çalıştırma ilk REVOKE sırasında 'function does not exist' hatası verir; sonraki DROP FUNCTION IF EXISTS bunu önleyemez.",
      "better_approach": "Silinecek fonksiyonlar için gereksiz REVOKE ifadelerini kaldır veya varlık kontrolüyle koşullandır.",
      "reason": "İlk rollback'teki bağımlılık sırası doğru: politikalar kaldırılıyor, RPC gövdeleri geri yükleniyor, yardımcılar düşürülüyor. Hata, dosyanın açıkça vaat ettiği tekrar çalıştırılabilirlikte."
    },
    {
      "severity": "medium",
      "category": "performance",
      "file": "supabase/migrations/0033_admin_mfa.sql:52",
      "issue": "Politikalar is_admin_user() ve session_is_aal2() fonksiyonlarını doğrudan çağırıyor. STABLE, sonuçların ifade başına yalnız bir kere hesaplanacağını garanti etmez; özellikle SET search_path taşıyan is_admin_user() her değerlendirilen satırda agents sorgusu çalıştırabilir.",
      "better_approach": "Satırdan bağımsız çağrıları (select public.is_admin_user()) ve (select public.session_is_aal2()) biçiminde sar; storage politikasında da uygula. Gerçek maliyeti EXPLAIN ANALYZE ile ölç.",
      "reason": "Bu bir yetki açığı değil, büyük taramalarda gereksiz tekrar riski. Supabase bu sarmalamayı statement başına initPlan için öneriyor: [RLS performans belgesi](https://supabase.com/docs/guides/database/postgres/row-level-security)."
    },
    {
      "severity": "low",
      "category": "maintainability",
      "file": "supabase/migrations/0033_admin_mfa.sql:26",
      "issue": "is_admin_user() mevcut agents_self_select sayesinde kendi admin satırını görür; agents politikası yardımcıya başvurmadığından mevcut tanımlarda özyineleme yoktur. Ancak invoker sorgusunda admin satırı ileride RLS ile görünmez olursa EXISTS false döner ve NOT is_admin_user() MFA kapısını açar: yardımcı, satır görünmezliği açısından fail-open davranır. SELECT/EXECUTE yetkisi tamamen kaldırılırsa ise sorgu hata verir, erişim açılmaz.",
      "better_approach": "agents_self_select bağımlılığını açık sözleşme olarak koru ve admin aal1 için regresyon kontrolü ekle. Bu yardımcıyı agents politikasına doğrudan ekleyerek döngü oluşturma.",
      "reason": "Mevcut şemada somut bypass yok: id=auth.uid() admin satırını görünür kılıyor. Risk, görünmeyen admin ile admin olmayan kullanıcının aynı false sonucuna indirgenmesi."
    },
    {
      "severity": "low",
      "category": "maintainability",
      "file": "supabase/migrations/0033_admin_mfa.sql:94; supabase/rollback/0033_admin_mfa_rollback.sql",
      "issue": "Fonksiyon karşılaştırmasında iş mantığı farkı bulunmadı. 0024'teki admin_get_threshold/admin_set_threshold için tek gövde eki '+ if not public.session_is_aal2() then return jsonb_build_object('ok', false, 'error', 'mfa_required'); end if;'. 0028'deki review_approve/review_reject için aynı ek var; ayrıca '- SECURITY INVOKER' kaldırılmış, fakat varsayılan INVOKER olduğundan davranış korunuyor. Rollback gövdeleri MFA öncesine dönüyor.",
      "better_approach": "İncelemeyi kolaylaştırmak için iki review fonksiyonunda açık SECURITY INVOKER ifadesini koru.",
      "reason": "İki threshold fonksiyonunda SECURITY DEFINER, dört fonksiyonda public,pg_temp search_path ve imzalar korunmuş. CREATE OR REPLACE mevcut sahipliği ve grant'leri korur: [PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html). Bu fark işlevsel engel değildir."
    },
    {
      "severity": "low",
      "category": "reliability",
      "file": "supabase/migrations/0033_admin_mfa.sql; supabase/rollback/0033_admin_mfa_rollback.sql",
      "issue": "Dosyalarda açık transaction sınırı yok. Migration'ın kendi bağımlılık sırası doğru ve yeniden uygulanabilir; fakat çalıştırıcı ifadeleri ayrı ayrı commit ederse DROP POLICY ile CREATE POLICY arasında koruma boşluğu, sonraki hatalarda kısmi kurulum oluşabilir. Canlı çalıştırıcının transaction davranışı bu incelemede doğrulanmadı.",
      "better_approach": "Migration ve rollback'i tek transaction içinde, storage.objects üzerinde politika değiştirme yetkisi bulunan migration rolüyle çalıştır; ilk hatada tamamının geri alınmasını sağla.",
      "reason": "Önce yardımcıların oluşturulması, sonra politikalar ve RPC'lerin değiştirilmesi geçerli sıradır. Tek seferde güvenli uygulama sonucu, dosya içeriğine ek olarak çalıştırıcının atomiklik ve sahiplik yetkilerine bağlıdır."
    },
    {
      "severity": "low",
      "category": "scope",
      "file": "supabase/migrations/0033_admin_mfa.sql:85; supabase/migrations/0030_support_messages.sql; supabase/migrations/0029_showcase.sql",
      "issue": "Kapsam kontrolünde ek bir doğrudan admin politikası atlanmış görünmüyor: support_messages üzerinde kullanıcı politikası yok; showcase_items security_invoker ve authenticated/anon grant'leri kaldırılmış; eski approve_raw_listing/reject_raw_listing INVOKER olarak korunan tablolara tabidir. Storage filtresi property-videos ve video-order-assets için doğru; agent-logos dalı true olduğundan logo erişimini değiştirmez. Ancak service_role ile yapılan destek okumasına veya önceden verilmiş imzalı URL'lere bu MFA politikası uygulanmaz.",
      "better_approach": "Service-role kullanan admin uygulama yollarında aal2 kontrolünü koru; destek tablosuna ileride authenticated admin politikası eklenirse aynı MFA kısıtını ekle. İmzalı URL sürelerini erişim sözleşmesine dahil et.",
      "reason": "TO authenticated politikası doğrudan supabase_storage_admin rolünü hedeflemez; authenticated'a rol üyeliği bulunması ayrıca canlı katalogdan doğrulanmalıdır. service_role BYPASSRLS nedeniyle etkilenmez; kullanıcı isteği authenticated olarak çalıştırıldığında politika uygulanır. [Storage erişim kontrolü](https://supabase.com/docs/guides/storage/security/access-control)."
    },
    {
      "severity": "low",
      "category": "security",
      "file": "supabase/migrations/0033_admin_mfa.sql:39",
      "issue": "session_is_aal2() eksik veya farklı aal değerini false kabul ederek doğru kapanıyor. Üst düzey aal claim'i Auth tarafından imzalanır; istemcinin JWT metnini veya user_metadata'yı değiştirmesi geçerli aal2 üretmez. Bununla birlikte auth.jwt() kendi başına imza doğrulamaz; güven API katmanının doğruladığı JWT'yi DB request context'ine koymasına dayanır.",
      "better_approach": "Mevcut üst düzey aal kontrolünü koru. Refresh sonrası normal MFA oturumunda aal2'nin sürmesini bekle; faktör kaldırma veya oturum değişimindeki düşürmeyi ve eski JWT'nin sona erene kadar geçerliliğini hesaba kat.",
      "reason": "Refresh yeni bir MFA doğrulaması gerektirmeden oturumun assurance bilgisini taşıyabilir; bu mekanizma her işlemde yeniden TOTP istemez. Faktör kaldırıldıktan sonra mevcut aal2 JWT anında değişmez. [JWT belgesi](https://supabase.com/docs/guides/auth/jwts), [MFA belgesi](https://supabase.com/docs/guides/auth/auth-mfa), [Auth token uygulaması](https://github.com/supabase/auth/blob/master/internal/api/token.go)."
    }
  ],
  "verdict": "block"
}