# Test Diff — checkout-webhook-test-gaps

## Genişletilen Dosyalar
- `web/src/app/api/subscriptions/checkout/route.test.ts` (+4 test)
- `web/src/app/api/webhooks/payment/route.test.ts` (+1 test, `PAYMENT_FAILED_EVENT` sabiti eklendi)

## AC → Test Eşleşmesi
| AC | Test |
|---|---|
| AC-1 (400) | "AC-1: plan_id hiç gönderilmezse 400 INVALID_INPUT döner..." |
| AC-2 (504) | "AC-2: sağlayıcı TimeoutError fırlatırsa 504 PAYMENT_TIMEOUT döner..." |
| AC-3 (502) | "AC-3: sağlayıcı TimeoutError dışında hata fırlatırsa 502 PAYMENT_PROVIDER_ERROR döner..." |
| AC-4 (409/23505) | "AC-4: insert 23505 unique-violation dönerse 409 ALREADY_SUBSCRIBED döner..." |
| AC-5 (webhook PAYMENT_FAILED) | "AC-5: pending aboneliğe PAYMENT_FAILED gelirse 200 received:true döner..." |

## Plandan Sapma — fake-supabase.ts'de Bulunan Gerçek Hata
AC-4 testi, plan.md'nin öngördüğü `uniqueColumns` mekanizmasıyla YAZILAMADI.
Kök neden: `FakeQuery.execute()`'in `mode === "single"` dalı, insert'in
`duplicate` kontrolünden gelen 23505 hatasını EZİYOR — `result.data` null
olduğunda (hem "hiç satır yok" hem "duplicate hatası" durumunda) `rowsOut =
[null]`, `first = null` oluyor ve bu, HER İKİ durumda da `PGRST116` hatasına
dönüştürülüyor (bkz. `fake-supabase.ts` satır ~171-177). `checkout/route.ts`
`.insert().select("id").single()` çağırdığı için bu bug'a çarpıyor.

**Workaround (test dosyasında, plan.md'nin izin verdiği kapsam içinde):**
AC-4 testi `createServiceRoleClient`'ı doğrudan bir stub ile mock'layıp
gerçek 23505 hatasını döndürüyor — route'un GERÇEK 23505-yakalama dalı
(satır 89) yine de gerçekten tetikleniyor, sadece fake-supabase'in insert
zincirine güvenilmiyor. "Doğrudan tetikleme" kuralı ihlal edilmiyor.

**Bu bir test-gap/altyapı bulgusu, backlog'a ayrı madde olarak eklendi**
(is-listesi-ve-sayfa-envanteri.md) — `fake-supabase.ts`'in `single()`
modunun duplicate-insert hatasını PGRST116 ile ezmesi, bu görevin dışında
başka testleri de etkileyebilir (henüz etkilemedi, ama potansiyel risk).

## Doğrulama
`npx vitest run` (web/, iki dosya) → Test Files 2 passed, Tests 24 passed
(orkestratör tarafından bağımsız olarak tekrar çalıştırılıp doğrulandı).
