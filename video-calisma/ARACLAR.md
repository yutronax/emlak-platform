# video-calisma — araç kataloğu

Tüm betikler `video-calisma/` kökünden çalıştırılır. Python: `.venv-capcut/Scripts/python.exe -X utf8` (OpenCV, librosa, torch gerekenler) ya da sistem `python -X utf8`.
Gemini anahtarı `%USERPROFILE%\.gemini-anahtar` (repo dışı). Kurallar: fiyat/m²/telefon uydurma; stok görüntüye "İNZA · ÖRNEK KURGU"; YZ ses/hareket notu kapanışta; CC BY müziğe kredi.

## 1. Ana akış (önerilen) — Gemini JSON + Remotion
| Adım | Araç | Ne yapar |
|---|---|---|
| 1 | `kurgu/klip_analiz.py` | Ham klip klasörünü etiketli tek reelde birleştirir, Gemini'ye klip analizi yaptırır |
| 2 | `kurgu/gemini_kurgu_json.py <reel> <klipler.json> "<bilgiler>" <cikti.json> ["<yön>"] [ek.txt]` | Gemini ayrıntılı kurgu JSON'u yazar (müzik, açılış tekniği, font, yazı stili/konumu, efekt, geçiş, geçiş sesi, logo animasyonu) |
| 3 | `remotion/kurgu_uygula.py <gemini.json> <klipler.json> <props.json> "<not>"…` | JSON'u şablon props'una çevirir (klip yolları, süre sınırı, kapanış) |
| 4 | `cd remotion && npx remotion render IlanYaratici ../cikti/<ad>.mp4 --props=<props.json>` | Dikey 1080×1920 render |
| 5 | `izlet.py <video.mp4> "<not>"` | Gemini bitmiş videoyu izler, `-elestiri.md` yazar (**her gönderimden önce zorunlu**) |

- Şablonlar: `remotion/src/IlanYaratici.tsx` (Gemini JSON'lu, esnek), `remotion/src/IlanDikey.tsx` (basit veri dosyası), geçişler `remotion/src/hizliGecisler.tsx`. Ayrıntı: `remotion/README.md`.
- Menü: 9 açılış yazı stili · 6 açılış tekniği (sonucla_basla, kalip_kirma, bolunmus_giris, hizli_zoom_giris, donusum, sessizlik_vurus) · 10 yazı stili · 6 font · 20 geçiş · 5 geçiş sesi · 4 plan efekti · ızgara (2x2/3x3) · hız · 4 logo animasyonu (varsayılan **yukselis**).
- **Yaratıcılık katmanı** (`arastirma/yaraticilik/YARATICILIK-SINIRI.md`): Gemini önce 3 konsept yazıp seçer; `kurgu/gecmis-yaratici.json` tekrar defteri (son 3 videonun teknikleri yasak); her videoya rastgele **kısıt kartı**; **enerji eğrisi**; plan başına **ortam sesi** (`remotion/public/medya/ortam/`: adim, anahtar, kapi, kus, perde_hisirti, sehir, su, zil — ffmpeg sentezi); her videoda ≥1 **yeni teknik** önerisi → `kurgu/efektler/YENI-TEKNIK-ADAYLARI.md`. `izlet.py` eleştirisi 'tahmin edilebilir anlar' başlığı da yazar.
- Çekim rehberi (danışman için): `arastirma/CEKIM-REHBERI-60SN.md`.
- Klip kuralı: Remotion'a giden klipler **her kare anahtar kare** kodlanır (`-g 1 -bf 0 -video_track_timescale 30000`), yoksa kare atlar (takılma).

## 2. Görüntü hazırlama (gerçek telefon çekimi)
| Araç | Ne yapar |
|---|---|
| `kurgu/derinlik_hareket.py` | Net tek kareden derinlik haritasıyla 2.5B kamera hareketi (titreme yok) |
| `kurgu/panorama_gezinme.py` | Kamera dönen yerlerde kareleri panoramaya birleştirip üzerinde gezinme |
| `kurgu/yz_hareket.py` | Yerel LTX-Video ile kareden YZ klip (model indirilmedi; Google Flow tercih edildi) |
| `kurgu/sanal_doseme.py` | Boş oda fotoğrafına YZ döşeme (yalnız açık izin + not ile) |
| Sabitleme | Yalnız **rijit** vidstab (optik akış/warp YASAK — dalgalanma yapar). Örnek komut: `kurgu/projeler/dikey/gercek-ilan-1/rijit_duzelt.py` |
| Google Flow | Kareden Veo/Omni klip; tarayıcıdan. İstem: "kamera aynı odada kalsın", kısa hareket; uydurma kontrolü şart |

## 3. Efekt ve geçiş kütüphanesi
| Araç | Ne yapar |
|---|---|
| `kurgu/efektler/` (KATALOG.json, EFEKT-KUTUPHANESI.md, HYPERFRAMES-KATALOG.json) | 45 ffmpeg/OpenCV efekt + 23 motor seçeneği + 199 HyperFrames parçası |
| `kurgu/cizimden_gercege.py` | Karakalem çizimden gerçeğe açılış |
| `kurgu/nostalji_ritim.py` | Eski film görünümü + müziğin vuruşlarına tepki veren efektler (librosa) |
| `kurgu/gecis_motoru.py` | Yatay (16:9) hız rampalı bağlayıcılı geçiş motoru v2 |
| `kurgu/gecis_seridi.py` | Kesim anlarından kare şeridi (kontrol) |

## 4. Yönetmen/kurgucu akışı (yatay, eski ana akış)
| Araç | Ne yapar |
|---|---|
| `kurgu/yonetmen.py <klasör> <ad> --render [--radikal] [--yon "…"]` | Gemini yöntem tarif eder → Codex uygular → Gemini eleştirir |
| `kurgu/uret.py` | Brif → TTS → motor → kontrol zinciri |
| `kurgu/yz_ses.py` | Gemini TTS seslendirme |

## 5. Araştırma / referans
| Araç / dosya | Ne yapar |
|---|---|
| `izlet_youtube.py <id> <cikti.md>` | YouTube videosunu Gemini'ye çözdürür |
| Instagram | `yt-dlp` ile indir → Gemini analizi (`arastirma/instagram/ref1/`) |
| `arastirma/REFERANSLAR-ACILIS-HOOK.md` | Reels açılış (hook) teknikleri ve kaynaklar |
| `arastirma/araba/` | Araba editlerinden emlağa taşınabilir teknikler |

## 6. Eski şablon üreticileri (HyperFrames / CapCut — referans)
`kurgu/kur.py` (brif → HyperFrames), `kurgu/defter_hazirla.py`, `galeri_hazirla.py`, `tahmin_hazirla.py`, `yatay_rampa.py`; `capcut/*.py` (pycapcut ile CapCut projeleri; beğenilen: `tanitim_marka.py`); `ilan-video.ps1` (ilk ffmpeg storyboard akışı).

## 7. After Effects köprüsü
| Araç | Ne yapar |
|---|---|
| `after-effects/ae.ps1 -Betik <jsx>` | AE kapalıysa açar, hazır olana kadar bekler, betiği çalıştırır, log'u okur |
| `after-effects/ae.ps1 -Render <aep> -Comp <ad> -Cikti <mp4>` | aerender → Lossless AVI → MP4 |
| `after-effects/ae_sablon.jsx` | Örnek: klipler + Sapphire geçiş/ışık + harf animasyonlu yazı |
| `after-effects/ae_kurgu.py <props.json> <ad> [--sadece-kur]` | **Remotion props'undan AE kurgusu**: aynı planlar/yazılar/müzik, geçişler ve görünüm test edilmiş kısa menüden (`arastirma/AFTER-EFFECTS-KISA-MENU.md`; Gemini `sonraki_gecis.ae` + `ae.gorunum` verir) → `cikti/ae-<ad>.mp4`. Şablon: `ae_kurgu_sablon.jsx` |
| `kurgu/kesit_hazirla.py` | Ham turdan seçilen kesitleri rijit sabitler, anahtar kare kurallı dikey klip yapar |

Kurallar ve yaşanan hatalar: `.claude/skills/ilan-video-edit/SKILL.md` → "Medya yükleme kuralları" ve "After Effects yolu". Proje/medya her zaman `C:\inza-ae\` (ASCII yol).

## Arşiv
`kurgu/arsiv/` — tek seferlik tur/düzeltme betikleri (esik_*, hareket_*, plan_*, yz_hazirla/kompozisyon/kontrol/teslim, hf_v2_setup, projeyi_hazirla_gemini). Çalıştırılmaz, yalnız geçmiş için.
