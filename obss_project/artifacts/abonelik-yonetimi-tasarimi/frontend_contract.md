# Frontend Contract — abonelik-yonetimi-tasarimi

> Kaynak: sayfa listesi #3; kullanıcı kararı "önce tasarımlar, sonra backend bağlamaları" (2026-11-01). atdd.md yok.
> Mevcut `/account/subscription` production'da gerçek veriyle çalışıyor → yeni tasarım yalnız
> `NEXT_PUBLIC_BILLING_MOCK=1` (dev) iken gösterilir; bayraksız eski sayfa aynen kalır. Backend'e bakılmadı.

## Tasarım yönü
Panel kabuğu içinde, profil sayfasıyla aynı dil: `fog-50` zemin, beyaz kartlar, tek vurgu terracotta.
1. **Mevcut plan kartı** — plan adı, aylık fiyat, durum rozeti (metin + renk), duruma göre tek cümle ve tek birincil aksiyon.
2. **Planı değiştir** — plan kartları yan yana (mobilde alt alta); mevcut plan işaretli.
3. **Ödeme geçmişi** — tablo (tarih · açıklama · tutar · durum · makbuz); dar ekranda tablo kendi kabında kayar.
4. En altta sakin bir "Aboneliği iptal et" bağlantısı (yalnız iptal edilebilir durumlarda).

## UI modeli
```ts
type SubscriptionStatus = "active" | "trialing" | "past_due" | "pending" | "needs_review" | "failed" | "canceled" | "none";
type Plan = { id: string; name: string; priceMinor: number; features: string[] };
type Subscription = { status; plan: Plan | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; trialEnd: string | null };
type Payment = { id: string; date: string; description: string; amountMinor: number; status: "paid" | "failed" | "refunded"; receiptUrl: string | null };
```

## Servis
```ts
interface BillingService {
  load(): Promise<{ status: "ok"; subscription; plans; payments } | { status: "error" }>;
  changePlan(planId): Promise<{ status: "ok"; subscription; effective: "now" | "period_end" } | { status: "redirect"; url } | Err>;
  cancel(): Promise<{ status: "ok"; subscription } | Err>;          // dönem sonunda biter
  resume(): Promise<{ status: "ok"; subscription } | Err>;          // dönem sonu iptalini geri al
  updatePaymentMethod(): Promise<{ status: "redirect"; url } | Err>;
}
```

## Durum → ekran
| Durum | Cümle | Birincil aksiyon |
|---|---|---|
| active | "Yenilenme: {tarih}" | — (plan değiştir / iptal mevcut) |
| active + cancelAtPeriodEnd | "{tarih} tarihinde sona erecek" | **İptali geri al** |
| trialing | "Deneme {tarih} tarihinde bitiyor" | — |
| past_due | alert: "Son ödemeniz alınamadı. Erişiminiz kesilmeden ödeme yönteminizi güncelleyin." | **Ödeme yöntemini güncelle** |
| pending | "Ödemeniz onay bekliyor; birkaç dakika sürebilir." | — (değiştir/iptal gizli) |
| needs_review | "Ödemeniz inceleniyor; sonuçlanınca e-posta ile haber vereceğiz." | — |
| failed | "Ödeme tamamlanamadı." | **Planları gör** (plan kartlarına kaydırır) |
| canceled / none | boş durum: "Aktif aboneliğiniz yok" + plan kartları "Planı seç" | — |
| load error | "Abonelik bilgisi yüklenemedi" + **Tekrar dene** (boş "abonelik yok" ile karıştırılmaz) | |

- Plan değişikliği onay penceresi: yükseltme "hemen geçerli, fark tahsil edilir"; düşürme "{dönem sonu} tarihinde geçerli".
  Servis `redirect` dönerse ödeme sayfasına gidilir. Başarıda: "Planınız {ad} olarak güncellendi" / "{tarih} tarihinde {ad} planına geçeceksiniz".
- İptal penceresi: "{tarih} tarihine kadar tüm özellikleri kullanmaya devam edersiniz." **İptal et** / **Vazgeç**. "İptal edildi" denmez; "sona erecek" denir.
- Pencereler: `role=dialog` + `aria-modal`, açılınca birincil olmayan (güvenli) düğmeye odak, Esc kapatır, odak tetikleyiciye döner.

## Görsel kabul kriterleri
- V-1: 1440/768/390'da sayfa yatay taşmaz (tablo kendi kabında kayabilir).
- V-2: Durum rozeti metin içerir; renk tek başına anlam taşımaz.
- V-3: past_due alert'i ilk ekranda görünür ve aksiyonu içerir.

## Backend'e istekler / sorular
1. Dönem sonunda iptal (`cancelAtPeriodEnd`) ve geri alma iyzico aboneliğinde destekleniyor mu?
2. Plan yükseltmede fark (proration) hesaplanıyor mu, yoksa yeni dönem mi başlıyor?
3. Ödeme yöntemi güncelleme için iyzico'nun kart güncelleme sayfası URL'si üretilebilir mi?
4. Ödeme geçmişi ve makbuz/fatura bağlantısı nereden okunacak?
5. Deneme süresi (`trialEnd`) var mı?
