# After Effects — emlak tanıtımı kısa menüsü (~30 efekt)

Kaynak: Boris FX Sapphire AE özet dizini (https://borisfx.com/documentation/sapphire/ae/summary-index/) + yerel envanter (`AFTER-EFFECTS-OZELLIKLER.md`, 1182 efekt).
Seçim ölçütü: dikey 9:16 emlak filmi, gerçek mekânı bozmayan, beğenilen **tek yönlü geçiş motifi** ve "efekt ~4–5 sn'de bir" kuralıyla uyumlu.
Durum: belgeye göre seçildi; **AE'de test karesi henüz alınmadı** (sıradaki iş).

## 1. Geçişler (tek yön motifi — en fazla 1 tür / video)
| Efekt | Ne yapar | Ne zaman |
|---|---|---|
| S_SwishPan | Hareket bulanıklıklı hızlı kaydırma | Oda→oda ana geçiş (varsayılan) |
| S_WhipLash | Kırbaç hareketi + RGB ayrışma | Enerjik açılış, en fazla 1 kez |
| S_HyperPush / S_HyperPull | Z ekseninde iterek/çekerek geçiş | İçeri girme hissi (kapı→salon) |
| S_Swish3D | Karşılıklı 3D hareketli geçiş | Yatay (16:9) filmler |
| S_DissolveLightLeak | Işık kaçaklı çözülme | Sıcak/duygusal anlar, balkon/gün ışığı |
| S_DissolveDefocus | Odak kaçarak geçiş | Sakin geçiş, kapanışa giriş |
| S_DissolveFilm | Parlak alanı koruyan film çözülmesi | Nostalji/klasik filmler |
| S_FilmBurnTransition | Film yanığı + sprocket | Yalnız "eski film" konseptinde |
| S_StripSlideTransition | Şeritler kayarak açılır | Izgara/özellik listesi geçişi |
| BCC Cross Zoom / BCC Light Leaks Dissolve | BCC karşılıkları | Sapphire yoksa yedek |

## 2. Işık (mekânı süsler, değiştirmez)
| Efekt | Ne yapar | Ne zaman |
|---|---|---|
| S_LightLeak | Soyut renkli ışık kaçağı | Ayar katmanı, %20–40 opaklık |
| S_Rays | Parlak alanlardan ışın | Pencereden giren güneş |
| S_LensFlareAutoTrack | En parlak noktayı izleyen mercek parlaması | Dron/dış cephe, güneşe dönük plan |
| S_Glint | Yıldız parıltısı | Musluk/avize üzerinde tek vurgu |
| S_BokehLights | Süzülen bulanık ışıklar | Açılış/kapanış logo arkası |
| S_UltraGlow | Katmanlı parlama | Logo, gece çekimi |
| S_Halation | Film gibi kırmızımsı ışık taşması | Sinematik görünüm |

## 3. Film / renk görünümü
| Efekt | Ne yapar | Ne zaman |
|---|---|---|
| S_FilmEffect | Film stoğu pozlama + gren | Tüm filme hafif "sinema" |
| S_Grain / S_UltraGrain | Gren | Telefon çekimini yumuşatmak, düşük doz |
| S_Vignette | Kenar karartma | Göz merkeze, her filmde hafif |
| S_BleachBypass | Yüksek kontrast, düşük doygunluk | Lüks/modern konsept |
| S_DuoTone / S_Tint | İki renkli ton | Marka renkli (altın/lacivert) açılış kartı |
| S_SoftFocus | Yumuşak odak | Yatak odası, sıcak anlar |

## 4. Hareket / kamera
| Efekt | Ne yapar | Ne zaman |
|---|---|---|
| S_WarpPerspective / S_WarpCornerPin | Görüntüyü eğik düzleme oturtur | Fotoğrafı ekrana/levhaya yerleştirme |
| S_Shake | Kontrollü sarsıntı | Yalnız vuruş anında, 2–3 kare |
| S_Retime | Optik akışla yavaşlatma | Ağır çekim (dikkat: warp artefaktı → kareleri kontrol et) |
| S_CutToDissolve | Tek klip içindeki kesimi çözülmeye çevirir | Ham turda zıplayan kesimler |

## 5. Takip / temizlik (Sapphire dışı)
| Araç | Ne yapar | Ne zaman |
|---|---|---|
| Mocha AE (planar takip) | Düz yüzeye yazı/işaret sabitler | Dron'da "daire bu binada" işareti, duvara yazı |
| AE 3D Camera Tracker | Sahneye 3D yazı yerleştirir | Koridor/salon içinde süzülen yazı |
| Content-Aware Fill | Nesne siler | Yalnız geçici eşya, kullanıcı izni + "görüntü düzenlendi" notu |
| Saber | Neon/ışın kenar | İNZA logosu açılış/kapanış |

## Test sonucu (2026-11-19, varsayılan ayarlarla, `C:\inza-ae\test\sayfa_*.png`)
Kurulum: `C:\inza-ae\betik\menu_test.jsx` (her efekt için bir comp + render kuyruğu). **Proje "Mercury Software Only" olmalı** (GPU ile 9988/19969 bellek hatası).
| Efekt | Sonuç | Not |
|---|---|---|
| DissolveDefocus | ✅ kullan | Temiz, sakin; mekânı bozmaz |
| DissolveFilm | ✅ kullan | Doğal çift pozlama |
| HyperPull | ✅ kullan (kısa) | Güçlü balık gözü çekme; videoda en fazla 1 kez |
| DissolveLightLeak | ⚠️ ayar şart | Varsayılan ortayı bembeyaz yakıyor + pembe/mor; parlaklık düşür, renk altına çek |
| FilmEffect, UltraGrain, SoftFocus, BleachBypass | ✅ hafif ton | Mekân rengini korur |
| LightLeak | ✅ | Hafif sarı sıcaklık; opaklık %40 |
| LensFlareAutoTrack | ✅ dron | Parlak noktayı kendisi buldu |
| Glint | ⚠️ ayar şart | Varsayılan dev yıldız pencereyi kapatıyor; boyut küçült |
| UltraGlow | ❌ varsayılan | Kareyi beyaza boğuyor; eşik çok yükseltilmeli |
| Vignette | ⚠️ ayar şart | Varsayılan çok dar/siyah; yarıçap büyüt, yumuşaklık artır |
| DuoTone | ⚠️ | Mor; marka renkleri (altın/lacivert) verilmeli |
| Tint, Shake, Rays, BokehLights | ➖ etkisi görünmedi | Bu karede/varsayılanla belirsiz; parametre gerekir |
| FilmBurnTransition, Halation | ❌ yüklü değil | Menüden çıkar |
| Swish3D | ✅ kullan | Yumuşak 3D kayma, mekân okunuyor |
| StripSlideTransition | ⚠️ | Şerit kayması hareketli ama dağınık; ızgara/özellik geçişine sınırla |
| SwishPan | ⚠️ ayar şart | Varsayılanda 3 sn boyunca tümden bulanık; süre (Overlap) ve Blur Amount kısılmalı |
| WhipLash | ⚠️ ayar şart | Kenarda tekrar eden görüntü (wrap) çıkıyor; Edge Mode değiştir |
| HyperPush | ❓ | Render yarım kaldı, tekrar denenecek |

### Ayarlı tur (`test/ayar_test.jsx`, `test/sayfa_ayar.png`)
| Efekt | Ayar | Sonuç |
|---|---|---|
| DissolveLightLeak | Transition Brightness 1.5→0.375, Saturation 0.5, Glow Brightness 0.125 | ✅ artık kullanılır: hafif pembe ışık, mekân okunuyor |
| Vignette | Radius ×1.6, Edge Softness 2, Opacity 0.6 | ✅ doğal kenar karartma |
| UltraGlow | Threshold 0.92, Brightness ×0.25 | ✅ çok hafif; pencere parlaması için |
| HyperPush | varsayılan | ⚠️ çalışıyor ama ortası güçlü bükülüyor (mekânı çarpıtır) → yalnız açılışta, çok kısa |
| Glint | Size ×0.25, Threshold 1.0 | ➖ artık görünmüyor; eşik ~0.85 denenmeli |
| DuoTone | Mix With Source 0.55 (renk ataması betikle olmadı) | ⚠️ sıcak sarı ton; marka renkleri elle seçilmeli |
| SwishPan | Blur ×0.5, Swish Auto Trans 1/2 | ❌ hâlâ 3 sn boyunca bulanık — anahtar kare dikkate alınmıyor. **Kullanma**; tek yön kaydırma için Swish3D ya da BCC Swish Pan |
| WhipLash | Edge Mode 1/2/3 | ❌ üçünde de sonda görüntü tekrar ediyor (wrap). **Kullanma** |

**Güncel menü (Gemini'ye verilecek):** geçiş = DissolveDefocus · DissolveFilm · Swish3D · HyperPull · DissolveLightLeak(ayarlı); ışık/görünüm = LightLeak · LensFlareAutoTrack · UltraGlow(ayarlı) · Vignette(ayarlı) · FilmEffect · UltraGrain · SoftFocus · BleachBypass.

Kareler: `arastirma/after-effects/test/sayfa_efekt.png`, `sayfa_gecis.png`, `sayfa_gecis2.png`; betik `test/menu_test.jsx`.
**Kesin kullanılabilir (varsayılanla):** DissolveDefocus, DissolveFilm, Swish3D, HyperPull, LightLeak, LensFlareAutoTrack, FilmEffect, UltraGrain, SoftFocus, BleachBypass.
**Teknik kurallar (yaşandı):** Sapphire geçişlerinde `Auto Trans`=1 + `…Percent` 0→100 anahtar kare + `Background` katman parametresi; aerender'ı `-comp` ile tek tek değil, render kuyruğunu (`rq.render`) ayarlayıp tek çağrıda çalıştır (tek tek çağrıda dosya yazmadı / takıldı); `AfterFX.com` artığı kalırsa sonraki render bekler.

## Yeni teknik turu (2026-11-19, `test/yeni_test*.jsx`, `C:\inza-ae\test\sayfa_yeni*.png`)
| Teknik | Sonuç |
|---|---|
| **BCC (tüm efektler)** | ❌ **LİSANSSIZ — render'da kırmızı X filigranı.** BCC kullanılmaz (Cross Zoom, Light Leaks Dissolve, Lens Flare Dissolve/3D, Lens Flash, Light Sweep, Particle Emitter 3D denendi) |
| 3D katman/kamera (AE yerel) | ✅ gerçek perspektifli süzülme → `ae_kurgu.py --yenilik` |
| Saber (Video Copilot) | ✅ filigransız. `Core Type`=3 (Text Layer) + `Text Layer` = yazı katmanı → yazı kenarında altın neon; `Glow Intensity` ~6 (30 fazla parlak), katman ADD. Renk parametresi betikle atanamadı (varsayılan sıcak sarı uygun) |
| CC Light Rays | ➖ merkez betikle atanamadı; sol üstte güneş lekesi |
| CC Light Sweep (yazı) | ➖ etkisi görünmedi |
Not: bazı renk/nokta parametreleri `setValue` ile "invalid numeric result" veriyor (Saber Glow Color, Sapphire DuoTone Color, CC Light Rays Center) — elle ya da ön ayar (preset) ile verilmeli.

## Kaçınılacaklar (emlakta güven bozar ya da kalıp durur)
- Kaleidoscope, FlysEye, Psyko*, Zap/Lightning, LaserBeam, MuzzleFlash, Glitch (DigitalDamage/TVDamage/PixelMosh) — mekânı gizler, ucuz durur.
- Warp/Distort/Vortex/Puddle — mülkü olduğundan farklı gösterir.
- S_Beauty, S_Sketch/Cartoon/Paint — gerçeklikten koparır (yalnız "çizimden gerçeğe" açılışında bilinçli kullanım).
- Aynı videoda birden fazla gösterişli geçiş türü (tek yön motifi bozulur).

## Gemini'ye verilecek menü (JSON alanı önerisi)
`ae_gecis`: SwishPan | WhipLash | HyperPush | DissolveLightLeak | DissolveDefocus | DissolveFilm
`ae_isik`: LightLeak | Rays | LensFlareAutoTrack | BokehLights | yok
`ae_gorunum`: FilmEffect | BleachBypass | SoftFocus | yalnız_vignette
`ae_takip`: mocha_isaret | kamera_takip_yazi | yok
