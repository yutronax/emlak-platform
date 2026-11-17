#!/usr/bin/env bash
# Parsel JSON'undan ilan-video-edit akışına uygun ayrı kamera planları (klipler) üretir.
# Kullanım: bash planlar.sh <parsel.json> <ilan_adi> [sure_sn]
# Çıktı: ../remotion/public/medya/<ilan_adi>/<plan>.mp4  (her kare anahtar kare)
#        ../klipler-<ilan_adi>.json
set -euo pipefail
cd "$(dirname "$0")"
PARSEL="$1"; ILAN="$2"; SURE="${3:-5}"
HEDEF="../remotion/public/medya/$ILAN"
mkdir -p "$HEDEF" kareler-plan
PLANLAR=(inis kusbakisi yorunge yaklasma ufuk)
for P in "${PLANLAR[@]}"; do
  rm -rf "kareler-plan/$P"
  PLAN=$P ADIM=10 node render.mjs "$PARSEL" "kareler-plan/$P" 1080 1920 "$SURE" 30
  ffmpeg -v error -y -framerate 30 -i "kareler-plan/$P/k%04d.jpg" \
    -c:v libx264 -pix_fmt yuv420p -crf 17 -g 1 -bf 0 -video_track_timescale 30000 "$HEDEF/$P.mp4"
  echo "plan $P hazir"
done
python -X utf8 - "$PARSEL" "$ILAN" "$SURE" <<'EOF'
import json, sys
parsel, ilan, sure = sys.argv[1], sys.argv[2], float(sys.argv[3])
p = json.load(open(parsel, encoding="utf-8"))["properties"]
notlar = {
  "inis": "Tepeden parsele iniş; sarı çizgi TKGM parsel sınırı. Açılış için uygun.",
  "kusbakisi": "Tam tepeden, parsel sınırı ve şekli net. Alan (m²) bilgisi buraya uygun.",
  "yorunge": "Alçak açıyla parsel çevresinde dönüş; yamaç ve arazi eğimi görünür.",
  "yaklasma": "Alçaktan parsele yaklaşma; arazinin dokusu (nitelik) görünür.",
  "ufuk": "Parselden geri çekiliş; çevre, tepeler ve ufuk açılır. Kapanış öncesine uygun.",
}
klipler = [{"ad": k, "video": f"medya/{ilan}/{k}.mp4", "en_fazla_sn": sure, "not": v} for k, v in notlar.items()]
bilgi = {"il": p["ilAd"], "ilce": p["ilceAd"], "mahalle": p["mahalleAd"], "ada": p["adaNo"],
         "parsel": p["parselNo"], "alan_m2": p["alan"], "nitelik": p["nitelik"], "mevki": p.get("mevkii"),
         "kaynak": "Google 3D uydu görüntüsü + TKGM parsel verisi (sanal çekim, drone değil)"}
json.dump({"ilan": ilan, "bilgi": bilgi, "klipler": klipler},
          open(f"../klipler-{ilan}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"../klipler-{ilan}.json")
EOF
