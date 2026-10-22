# Plan — checkout-reconciliation-job
_Reference: atdd.md_

Frontend-pipeline: tetikleyici yok (API route, UI yok).

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| (yok, tüm dosyalar yeni) | — | — | — |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| web/src/app/api/cron/reconcile-subscriptions/route.ts | AC-S1/S2/S3, AC-3/5/6/7 | backend |
| web/src/app/api/cron/reconcile-subscriptions/route.test.ts | Tüm AC'ler | backend |
| vercel.json | Cron yapılandırması (günde/saatte bir tetikleme) | devops |

## Dependencies
- **Secret doğrulama deseni:** `scraper/orchestrator.py`'deki
  `hmac.compare_digest` deseninin TypeScript karşılığı — `node:crypto`'nun
  `timingSafeEqual` (iyzico.ts'te zaten kullanılıyor, `verifyWebhookSignature`'da).
  ```ts
  import { timingSafeEqual } from "node:crypto";

  function isValidSecret(header: string | null): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false; // AC-S2: env yoksa HER ZAMAN false
    const expected = `Bearer ${secret}`;
    if (!header || header.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  }
  ```
  (`header.length !== expected.length` kontrolü `timingSafeEqual`'ın
  farklı uzunluktaki buffer'larda fırlattığı hatayı önlemek için —
  mevcut `iyzico.ts`'teki AYNI desen.)
- **Route handler:**
  ```ts
  export async function GET(request: NextRequest) {
    if (!isValidSecret(request.headers.get("authorization"))) {
      if (!process.env.CRON_SECRET) {
        return NextResponse.json({ error: "CONFIG_ERROR" }, { status: 500 });
      }
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const supabase = createServiceRoleClient(); // cron, kullanıcı oturumu yok
    const threshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("subscriptions")
      .update({ status: "needs_review" })
      .eq("status", "pending")
      .lt("created_at", threshold)
      .select("id");

    if (error) {
      console.error("reconcile-subscriptions: update başarısız", error);
      return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }

    return NextResponse.json({ updated: data?.length ?? 0 });
  }
  ```
  (`createServiceRoleClient()` kullanılıyor — bu endpoint'in çağıranı bir
  kullanıcı OTURUMU değil, Vercel Cron; RLS'e tabi bir kullanıcı context'i
  yok. Yetki kontrolü TAMAMEN `CRON_SECRET`'e bağlı, bu yüzden AC-S1/S2
  KRİTİK.)
- **`vercel.json`:**
  ```json
  {
    "crons": [
      { "path": "/api/cron/reconcile-subscriptions", "schedule": "0 * * * *" }
    ]
  }
  ```
  (Saatlik — eşik 1 saat olduğu için saatlik bir tarama yeterli.)

## Migration Required?
No.

## Risks
(atdd.md'den taşındı, yeni risk bulunmadı)

## Open Questions
Yok.

## Alan etiketleme
`route.ts`/`route.test.ts`: backend. `vercel.json`: devops (proje kök
dizininde bir yapılandırma dosyası, kod değil) — ama tek satırlık bir
JSON dosyası olduğu için ayrı bir devops-copilot dispatch'i gerekmez,
backend-copilot aynı dispatch'te yazabilir (CAVEMAN: gereksiz bir ek
dispatch turu açmamak için).
