Bağımsız veritabanı güvenlik incelemecisisin. Kod yazma/düzenleme, dosya yazma; SADECE incele.
Proje kökü: C:\Users\kuyus\OneDrive\Belgeler\Masaüstü\projelerim\emlak-platform
Oku: obss_project\artifacts\admin-mfa\atdd.md, supabase\migrations\0033_admin_mfa.sql, supabase\rollback\0033_admin_mfa_rollback.sql. Bağlam için supabase\migrations altındaki önceki migration'larda agents, raw_listings, listings, properties, property_videos, video_orders, video_order_assets tablolarının RLS politikaları ve storage.objects politikaları.

Bağlam (canlı DB'den okundu): bütün public tablolarda RLS açık. agents'ta agents_self_select (id = auth.uid()) politikası var. Admin erişimi bugün yalnız `exists(select 1 from agents a where a.id = auth.uid() and a.is_admin)` ile veriliyor. Supabase Auth JWT'sinde `aal` claim'i 'aal1' ya da 'aal2'. Scraper service_role ile çalışır (RLS'i atlar).

Amaç: admin oturumu aal2 değilse admin verisine (doğrudan REST/RPC dahil) erişilemesin; admin olmayan kullanıcılar ve service_role etkilenmesin.

Değerlendir ve SOMUT kanıtla raporla:
1. Kısıtlayıcı politika mantığı doğru mu? (`not is_admin_user() or session_is_aal2()`) — admin olmayan aal1 kullanıcı kendi satırlarına erişmeye devam ediyor mu; admin aal1 her şeyden mi kesiliyor (kendi emlakçı verisi dahil — kabul edilen davranış).
2. is_admin_user() security invoker + agents RLS: fail-open ya da fail-closed? Özyineleme/performans riski (her satırda çağrı; stable olması yeterli mi, `(select public.is_admin_user())` sarmalama gerekir mi?).
3. Dört fonksiyonun yeniden yazımı orijinal davranışı birebir koruyor mu (diff ver); SECURITY DEFINER ve search_path korunmuş mu; grant'ler create or replace ile korunur mu.
4. storage.objects kısıtlayıcı politikası: bucket filtresi doğru mu; storage'ın kendi iç rolleri (supabase_storage_admin, service_role) etkilenir mi; logo bucket'ı etkileniyor mu.
5. Bir tablo/ yol unutulmuş mu? (ör. admin'in veri gördüğü başka bir tablo, view, RPC; SECURITY DEFINER olup aal kontrolü olmayan admin yolu.)
6. Idempotentlik ve rollback doğruluğu; migration'ın canlıda tek seferde güvenle çalışıp çalışmayacağı (sıra, bağımlılık).
7. auth.jwt()->>'aal' güvenilirliği: refresh sonrası korunur mu, istemci değiştirebilir mi.

Yanıtın SADECE şu JSON olsun:
{"task":"admin-mfa-migration","summary":"<1-3 cümle>","findings":[{"severity":"critical|high|medium|low","category":"security|correctness|reliability|performance|maintainability|scope","file":"...","issue":"...","better_approach":"...","reason":"..."}],"verdict":"approve|approve-with-changes|block"}
