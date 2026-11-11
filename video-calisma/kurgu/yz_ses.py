# Yapay zekâ seslendirme (Gemini TTS): Türkçe metni doğal sesle okur → WAV.
# Videoda kullanılırsa açıklamaya "seslendirme yapay zekâ ile üretildi" notu düşülür.
# Kullanım: python -X utf8 kurgu/yz_ses.py <cikti.wav> "<metin>" [ses_adı]
import base64
import json
import os
import subprocess
import sys
import urllib.request

MODEL = "gemini-2.5-flash-preview-tts"


def anahtar():
    k = os.environ.get("GEMINI_API_KEY")
    return k or open(os.path.join(os.path.expanduser("~"), ".gemini-anahtar"), encoding="ascii").read().strip()


def seslendir(cikti, metin, ses="Charon"):
    govde = {"contents": [{"parts": [{"text": "Sıcak, güven veren, sakin bir emlak danışmanı tonuyla oku: " + metin}]}],
             "generationConfig": {"responseModalities": ["AUDIO"],
                                  "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": ses}}}}}
    r = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
                               data=json.dumps(govde).encode(), method="POST",
                               headers={"x-goog-api-key": anahtar(), "Content-Type": "application/json"})
    cevap = json.loads(urllib.request.urlopen(r, timeout=300).read())
    d = cevap["candidates"][0]["content"]["parts"][0]["inlineData"]
    pcm = cikti + ".pcm"
    open(pcm, "wb").write(base64.b64decode(d["data"]))          # 24 kHz, 16 bit, mono ham PCM
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", pcm, cikti], check=True)
    os.remove(pcm)
    return cikti


if __name__ == "__main__":
    print("yazıldı:", seslendir(sys.argv[1], sys.argv[2], *(sys.argv[3:4])))
