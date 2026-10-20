# Test Diff — agent-dashboard-auth-ve-ilan-akisi

## Oluşturulan dosya
- `web/src/app/agent/dashboard/page.test.tsx` (yeni, 9 test —
  `account/subscription/page.test.tsx` desenini takip ediyor)

## AC → Test eşlemesi
| AC | Test |
|---|---|
| AC-S1 | "oturum yoksa redirect('/login') çağırır ve subscriptions/listings sorgusu yapmaz" |
| AC-3 | `it.each` — trialing/active/past_due → doğru rozet (3 senaryo) |
| AC-4 | "açık satır yoksa ve en son satır canceled ise 'İptal edildi' rozetini gösterir" |
| AC-5 | "hiç subscription satırı yoksa 'Aboneliğiniz yok' rozetini gösterir" |
| AC-6 | "erişim koşulu sağlanıyorsa listings kayıtlarını... render eder ve doğru sorgu zincirini kullanır" |
| AC-7 | `it.each` — past_due / süresi dolmuş active → listings yok + CTA (2 senaryo) |
| AC-8 | "erişim koşulu sağlanıyor ama listings boşsa... CTA göstermez" |

## Red step
Implementasyon henüz yok (`page.tsx` değişmedi) — testlerin kırmızı
olması beklenir, `code-copilot` ile doğrulanacak.

## Change-log
Yok.
