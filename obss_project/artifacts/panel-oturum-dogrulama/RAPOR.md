# Panel oturum doğrulaması — 2026-10-31

## Sonuç
Gerçek (onaylı) bir test hesabıyla yerel dev sunucusunda (localhost:3000) e-posta/şifre girişi **çalışıyor**:
`sb-bbjmjzixcugdwbcwydux-auth-token` çerezi yazıldı, `/agent/dashboard` açıldı ve yeniden gezinmede açık kaldı.
"Yalnız PKCE code-verifier yazılıyor" belirtisi kodda bir hatadan kaynaklanmıyor: e-posta/şifre girişi verifier yazmaz;
o çerez kayıt/şifre sıfırlama akışından kalmış olmalı. Önceki doğrulamalarda geçerli/onaylı hesap yoktu (projede seed hesabı yok),
giriş bu yüzden başarısız oluyordu. `server.ts`, `proxy.ts`, `login/actions.ts`, `auth/callback/route.ts` değiştirilmedi.

## Regresyon testi
`web/src/lib/supabase/server.test.ts` — gerçek `@supabase/ssr` + sahte fetch ile `signInWithPassword` sonrası
`sb-<ref>-auth-token` çerezinin `cookies().set` ile yazıldığını ve localhost'ta çalışacak bayraklarla (domain yok, secure zorlanmaz, path `/`) geldiğini doğrular. 2/2 geçti.

## Test hesabı
Service-role admin API ile, kullanıcı onayıyla oluşturuldu: `panel-test+1793455927@example.com` (id 672f9938-…), e-posta onaylı,
company_name "Panel Test Emlak". Parola yalnız `web/.env.local` içinde (`TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD`, git'e girmez — ana checkout'taki .env.local'a taşınmalı).

## Ekran görüntüleri
- `dashboard-1280.jpg`, `dashboard-320.jpg`: "Bugün 0/10 ilan açık" görünüyor; 320px'te yatay taşma yok (scrollWidth=320).
- `whatsapp-1280.jpg`, `whatsapp-320.jpg`: risk onayı + "Bağla" (NEXT_PUBLIC_WA_LINK_ENABLED=1).
- 1280 görüntüleri pane küçültmesi nedeniyle düşük çözünürlüklü.

## Doğrulanamayanlar
- **Kilitli kart**: bugün 10'dan fazla ilan olmadığı için oluşmadı (veri gerektiriyor).
- **"Bildirimleri aç"**: `.env.local`'da VAPID public key yok → bileşen bilinçli olarak `null` döner.
- **Admin sayfaları**: test hesabı admin değil; açılmadı.

## Gri metin (#475569)
`.text-slate-500` öğeleri `rgb(71,85,105)` = #475569 render ediliyor; açık zemin (fog-50) üzerinde okunaklı.

## Ek gözlem
Dev'de `/agent/dashboard` için Next.js uyarısı: "encountered the unstable value `Date.now()` while prerendering" (ekranda "1 Issue" rozeti). Ayrı inceleme gerektirir.

## Test hesabı durumu (DB kontrolü)
`agents.is_admin = false`. `subscriptions` satırı `trialing` — elle eklenmedi, ilk girişte uygulamanın normal akışı (ensureAgentRow) oluşturdu.
