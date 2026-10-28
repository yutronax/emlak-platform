---
task_slug: faz0-vitrin-duzeltme
priority: high
threat_model: not_required   # yeni veri/kimlik/ödeme akışı yok; sadece metin, statik sayfa, dış wa.me linki
affected_modules: [web/src/app/(marketing), web/src/components]
test_strategy: unit (RTL) + canlı tarayıcı (desktop/mobile)
---
# ATDD — Faz 0: Vitrini gerçeğe uydur

Referans: `obss_project/artifacts/yol-haritasi.md` §3 Faz 0, `musteri-sayfalari-tasarim-yenileme/ikna-edicilik-arastirmasi.md` (dil kuralları), Opus dış-göz eleştirisi (2026-10-27).

## Persona
Teknolojiyle arası iyi olmayan bireysel/küçük ofis emlakçı, çoğunlukla mobilde.

## Goal
Sitede yanlış vaat kalmasın; yeni ürün tanımı (ana ürün: WhatsApp gruplarından gelen ilanların sitede düzenli/filtrelenebilir akışı + site bildirimi; ek ücretli hizmet: editörlerin hazırladığı reklam videosu) anlatılsın; güven açıkları (iletişim, destek, yasal linkler, boş plan kartları) kapansın.

## Acceptance Criteria
- **AC-1 Landing metni:** Hero ve "nasıl çalışır" ana ürünü anlatır: WhatsApp'ınızı bağlayın → hangi gruplardan ilan geleceğini seçin → ilanlar sitede düzenli, filtrelenebilir listelenir, yeni ilan gelince bildirim. "İlanı atın, videolu sayfa hazır olsun" vaadi kaldırılır.
- **AC-2 Video bölümü:** Landing'de ayrı bir bölüm: reklam videosu ücretli ek hizmettir; fotoğraf yükleyin / kendi çektiğiniz ham videoyu yükleyin / (uygunsa) yerinde çekim — videoyu editörlerimiz hazırlar. Fiyat yazılmaz ("fiyatlar yakında" ya da hiç), otomatik/yapay zekâ ile üretildiği iddia edilmez.
- **AC-3 WhatsApp destek butonu:** Tüm müşteri sayfalarında (landing/pricing/login/signup) sağ altta sabit buton; `https://wa.me/<numara>` linki, `target="_blank" rel="noopener noreferrer"`, erişilebilir adı "WhatsApp'tan destek alın". Numara TEK bir sabitte tanımlı (ör. `web/src/lib/contact.ts`), açıkça sahte: `905000000000`, yanında açılış öncesi değiştirilmesi gerektiğini söyleyen tek satır yorum.
- **AC-4 Footer:** İletişim (aynı sabitten WhatsApp numarası + link), "Gizlilik Politikası", "KVKK Aydınlatma Metni", "Kullanım Şartları" linkleri, telif satırı.
- **AC-5 Yasal taslak sayfalar:** `/gizlilik`, `/kvkk`, `/kullanim-sartlari` — `(marketing)` grubunda, en üstte belirgin "Taslak — hukuki kontrolden geçmemiştir" uyarısı, kısa ve olgusal içerik (hangi veriyi neden işliyoruz: hesap bilgisi, seçilen gruplardaki ilan metinleri, yüklenen fotoğraf/videolar; seçilmeyen grupların mesajları saklanmaz). Hukuki taahhüt içeren uydurma madde/şirket bilgisi YOK.
- **AC-6 SSS:** Yeni ürüne göre güncellenir; destek sorusu artık AC-3'teki linke gider. En az şu sorular: kurulum gerekir mi, ücretsiz deneme (kart istenmez), hangi gruplardan ilan geleceğini kim seçer, video nasıl hazırlanıyor/ücretli mi, destek.
- **AC-7 Fiyat kartları:** Her plana "Aylık" dönem etiketi ve 3-4 maddelik "neler dahil" listesi (statik, sıraya göre; içerik placeholder olabilir ama boş olamaz). Maddelerde "Pro", "Free", "Başlangıç" kelimeleri GEÇMEZ (mevcut test `getByText(/Pro/)` ile çakışır). Video hizmetinin ayrıca ücretli olduğu sayfada bir kez belirtilir.
- **AC-8 Kapsam dışı dokunulmaz:** `/agent/*`, `/admin/*`, API route'ları, DB, ödeme akışı değişmez. Login/signup form davranışı değişmez.

## Davranış sözleşmesi
| Durum | Beklenen |
|---|---|
| wa.me linki tıklanır | Yeni sekmede açılır, sayfa state'i korunur |
| Plan sayısı 3'ten farklı | Fazla planlar için madde listesi gösterilmez veya son liste tekrar kullanılır — ÇÖKMEZ |
| Mobil (375px) | Sabit buton içeriği/CTA'ları örtmez, yatay taşma yok |

## Risks / Assumptions
- Landing metni Faz 1-3'te gelecek özellikleri anlatıyor (henüz kodda yok). Site henüz yayında değil; açılış kontrol listesinde "vaat edilen her özellik canlı mı" maddesi gerekir.
- Sahte numara ve placeholder plan içerikleri canlıya kaçmamalı (yol-haritasi §6).

## Rollback
Tek commit; revert yeterli.
