# Video üretim hattı — iş dağılımı

Amaç: Claude'un (orkestratör) yükünü azaltmak. Her adım, onu en ucuz ve güvenilir yapabilecek "işçiye" verilir.
Claude yalnızca **yaratıcı karar + son kalite kontrolü** yapar.

## İşçiler

| İşçi | Güçlü yanı | Zayıf yanı |
|---|---|---|
| **Betik (Python + ffmpeg)** | Sıfır maliyet, her seferinde aynı sonuç | Sadece önceden yazılmış işi yapar |
| **Gemini API** (izlet.py, klip_analiz.py, yz_ses.py) | Videoyu izler, YouTube analiz eder, Türkçe seslendirir; ücretsiz kota | Puanlaması yüzeysel; sahte fiyatı/tekrar fotoğrafı kaçırdı |
| **Codex CLI (Pro)** | Uzun kodlama işleri, HyperFrames şablonu, görsel üretimi (sanal döşeme) | Sahte veri bırakabilir → mutlaka kontrol |
| **Claude Haiku/Sonnet alt ajan** | Dosya tarama, rapor, kare şeridi okuma, brif doldurma | Görsel zevk kararı vermemeli |
| **Sen (kullanıcı)** | Son beğeni, CapCut son rötuş, çekim | Zaman |

## Yapılan işler → kim yapabilir

| # | İş | Bugün kim yaptı | Bundan sonra kim | Not |
|---|---|---|---|---|
| 1 | Stok/ham görüntü bulma, indirme (Pexels) | Claude | **Haiku alt ajan** | Lisans + aynı ev şartı brifte yazılı |
| 2 | Klip analizi (kamera yönü, giriş/çıkış noktası, maskelenecek nesne) | Gemini (klip_analiz.py) | **Gemini** — değişmez | Çıktı: analiz.json |
| 3 | Plan sırası + geçiş türü seçimi (brif JSON) | Claude | **Claude** (yaratıcı karar) / taslağı Haiku | Kural: aynı efekt ardışık yok, aile yan yana yok — betik assert ediyor |
| 4 | Hız rampası + geçiş + renk + yazı + ses miksajı render | Claude yazdı, betik çalıştı | **Betik** (gecis_motoru.py brif.json) | Artık tek komut |
| 5 | Seslendirme metni | Claude | **Claude** veya Gemini | Fiyat/m²/telefon yok — MOCK kuralı |
| 6 | Seslendirme sesi (TTS) | Gemini (yz_ses.py) | **Gemini** | Kapanışta "yapay zekâ" notu otomatik |
| 7 | Hata ayıklama (ffmpeg filtre hataları, süre kayması) | Claude | **Codex** | Uzun deneme-yanılma işi |
| 8 | Yeni şablon/teknik geliştirme (HyperFrames) | Claude + Codex | **Codex** | Claude sadece kabul kontrolü |
| 9 | Sanal döşeme görseli | Codex (görsel aracı) | **Codex** | "temsilidir" etiketi zorunlu |
| 10 | Kare şeridi / kontrol kareleri | Betik (gecis_seridi.py) | **Betik** | |
| 11 | Kareleri inceleme (yazı doğru odada mı, sahte veri var mı) | Claude | **Claude** (son kontrol) — ön elemeyi Haiku | Gemini burada güvenilmez |
| 12 | Video eleştirisi / puan | Gemini (izlet.py) | **Gemini** | İkinci görüş; tek başına yeterli değil |
| 13 | YouTube/ödüllü video araştırması | Gemini (izlet_youtube.py) | **Gemini** | |
| 14 | Teknik havuzu / şablon dokümanı güncelleme | Claude | **Haiku alt ajan** | |
| 15 | Son rötuş, yayın | — | **Sen (CapCut)** | |

## Önerilen akış (yeni bir ilan için)

1. **Sen:** görüntüleri `varliklar/<ilan>/` klasörüne koy.
2. **Gemini:** `klip_analiz.py` → analiz.json.
3. **Claude:** analiz.json'a bakıp brif JSON yazar (plan sırası, geçişler, yazılar, seslendirme metni). ← tek yaratıcı adım
4. **Betik:** `yz_ses.py` + `gecis_motoru.py brif.json` → mp4.
5. **Betik + Haiku:** kontrol kareleri + ön eleme (sahte veri / yanlış oda / boş kare).
6. **Gemini:** `izlet.py` ikinci görüş.
7. **Claude:** son kontrol, sana gönderir.
8. Bir şey bozulursa → **Codex**'e hata + brif verilir.

Böylece Claude'un payı ~15 adımdan 2'ye (brif + son kontrol) iner.

## Eksik otomasyon (yapılırsa yük daha da azalır)

- `uret.py`: 2→6. adımları tek komutta zincirleyen sarmalayıcı (Codex yazabilir).
- Brif şablonu: analiz.json'dan otomatik ilk taslak brif (Gemini veya Haiku).
- Seslendirmenin süresini ölçüp kapanışa hizalayan başlangıç hesabı (şu an elle).
