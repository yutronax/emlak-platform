# After Effects 2023 (23.2.1) — bu bilgisayardaki özellikler (2026-11-19)

Betikle bağlantı: `AfterFX.exe -r <betik.jsx>` açık AE'de ExtendScript çalıştırır (çalıştı). Render: `aerender.exe`.
Toplam **1182 efekt**. Ham envanter (scratchpad'te üretildi): kategori + matchName listesi.

## Yüklü üçüncü parti paketler (asıl güç burada)
| Paket | Kategoriler | Bizim için öne çıkanlar |
|---|---|---|
| **Boris FX Continuum (BCC)** | Lights 38 · Film Style 23 · Transitions 73 · Particles 12 · Optical Diffusion 12 · Lens 6 · 3D Objects 6 · Textures · Warp · Stylize · Art Looks · Color & Tone · Image Restoration · Match Move | Light Leaks, Light Sweep, Lens Flare 3D, Rays, Glow; Film Grain/Damage/Looks; **Swish Pan, Cross Zoom, Light Leaks Dissolve, Lens Flare Dissolve, Blur Dissolve, Flutter Cut**; Particle Illusion; Smoke and Fog; Orbs |
| **Sapphire** | Transitions 65 · Lighting 25 · Render 39 · Stylize 59 · Time 30 · Distort 24 · Blur+Sharpen 23 · Adjust · Composite · Builder | **S_SwishPan, S_WhipLash, S_HyperPush/Pull, S_Swish3D, S_DissolveLightLeak, S_DissolveGlow, S_DissolveDefocus, S_FilmRoll, S_StripSlide, S_ParallaxStrips**; S_LightLeak, S_Glint, S_BokehLights, S_LensFlare, S_UltraGlow |
| **Boris FX Mocha** (AE + Pro) | planar takip | Ekrana/duvara yazı-grafik sabitleme, nesne takibi, temizleme (remove) |
| **Video Copilot Saber** | ışın/neon | Logo kenar parlaması, neon yazı, ışın çizgileri |
| **RE:Vision** (3 eklenti) | genelde Twixtor/ReelSmart/DE:Noise sınıfı | Gerçek ağır çekim / hareket bulanıklığı |
| **Cineware (Cinema 4D)** | 3D | C4D sahneleri içe alma |
| Animasyon presetleri (`?`, 101) | Transition Master, Light Leaks, Mood Lighting, Zoom/Slide geçişleri, Wiggle, Scale Bounce | Hazır geçiş/hareket ön ayarları |

## AE'nin kendi efektleri (seçme)
- **Geçiş (17):** CC Light Wipe, CC Glass Wipe, Card Wipe, Gradient Wipe, Iris/Radial/Linear Wipe, Venetian Blinds…
- **Üret (26):** CC Light Rays, CC Light Sweep, Lens Flare, Beam, Write-on, Stroke, Audio Spectrum…
- **Simülasyon (18):** CC Particle World, Particle Playground, Shatter, Card Dance, Caustics…
- **Renk (37), Bulanıklık (16), Bozulma (37), Stilize (25), Perspektif (10), Zaman (8), Gren (12), Keying (10)**
- Yazı: animatörler (harf/kelime/satır), text-on-path, 3D yazı (Cinema 4D renderer), metin şablonları.
- 3D kamera + ışık, 3D Camera Tracker (çekime 3D yazı yerleştirme), Warp Stabilizer (dikkat: warp — biz rijit kullanıyoruz), Content-Aware Fill (nesne silme), Roto Brush (özne ayırma), Motion Blur, ifadeler (expression) ile vuruşa tepki.

## Bizim akışa ne katar (Remotion'a göre)
1. **Sinematik ışık:** BCC/Sapphire ışık kaçağı, mercek, ışın, bokeh — elle yazdığımız CSS ışıklarından çok daha gerçekçi.
2. **Profesyonel geçişler:** S_SwishPan / BCC Swish Pan / S_WhipLash gerçek hareket bulanıklığıyla — beğenilen "tek yönlü motif" ama daha pürüzsüz.
3. **Takip:** Mocha / 3D Camera Tracker ile yazıyı duvara, balkon camına, dron'da binanın üstüne sabitleme ("hangi bina" sorununa çözüm: binanın üstünde takip eden işaret).
4. **Temizlik:** Content-Aware Fill ile dağınıklığı (masadaki şişe, balkondaki kâğıt) silme — DİKKAT: yalnız geçici eşya, kullanıcı izniyle ve "görüntü düzenlendi" notuyla.
5. **Film görünümü:** BCC Film Stocks / Film Grain / Light Flicker (nostalji videosu için).
6. **Neon/ışın logo:** Saber ile İNZA logosu kenar ışıması.

## Dikkat
- GPU3 sağlık testi uyarısı veriyor; AE çökerse Mercury Software Only ile çalış. Betik, AE tamamen açıldıktan (eklentiler yüklendikten) sonra gönderilmeli.
- Eklentilerin lisans durumu (deneme/filigran) render'da kontrol edilmeli.
