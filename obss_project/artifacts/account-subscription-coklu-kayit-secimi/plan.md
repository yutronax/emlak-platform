# Plan — account-subscription-coklu-kayit-secimi
_Reference: atdd.md_

Frontend-pipeline: tetikleyici VAR (`.tsx`) ama UI reshape DEĞİL —
veri-seçim correctness düzeltmesi, Design Direction atlandı.

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| web/src/app/account/subscription/page.tsx | AC-1..8 | medium | frontend |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| (yok — page.test.tsx zaten var, genişletilecek) | — | frontend |

## Dependencies
- **Sorgu değişikliği:** `.maybeSingle()` → `.order("created_at",
  {ascending:false})` (limit YOK, tüm satırlar). `.eq("agent_id",
  auth.user.id)` AYNEN korunur (AC-8 regresyon).
- **`pickSubscription(rows: SubscriptionRow[]): SubscriptionRow | null`**
  saf fonksiyon, aynı dosyada (CAVEMAN — ayrı dosyaya çıkarmaya değecek
  kadar büyük değil, tek bir sayfa kullanıyor):
  ```ts
  const STATUS_PRIORITY = ["active","trialing","past_due","pending","needs_review","failed","canceled"];
  function pickSubscription(rows: SubscriptionRow[]): SubscriptionRow | null {
    if (rows.length === 0) return null;
    for (const status of STATUS_PRIORITY) {
      const match = rows.find((r) => r.status === status);
      if (match) return match;
    }
    return rows[0]; // bilinmeyen status — en yeni satır (rows zaten created_at desc)
  }
  ```
  `rows` zaten `created_at desc` sıralı geldiği için `.find()` aynı
  öncelik seviyesinde İLK (en yeni) satırı doğal olarak seçer (AC-3).
- **`STATUS_LABELS`'a `trialing: "Deneme sürümü"` eklenir** (AC-7,
  `agent/dashboard` sayfasıyla aynı metin — bilinçli kod tekrarı,
  CAVEMAN: iki sayfa arasında paylaşılan bir sabit çıkarmak bu görevin
  kapsamını aşar).
- **past_due CTA (AC-5):** mevcut uyarı paragrafına `role="alert"`
  eklenir, altına `<Link href="/pricing">` eklenir.

## Migration Required?
No.

## Risks
(atdd.md'den taşındı, yeni risk bulunmadı)

## Open Questions
Yok.

## Alan etiketleme
Tek dosya: frontend.
