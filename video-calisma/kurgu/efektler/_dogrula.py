"""Katalog komutlarını gerçek kliplerle çalıştırır ve çıktıdan kare şeridi üretir.

Kullanım: python -X utf8 kurgu/efektler/_dogrula.py --kok <video-calisma>
Yalnız katalogdaki bağımsız efektleri yeniden çalıştırır. Motor örneklerinin
üretimi ilk derleme sırasında motorun AST üzerinden okunan tanımlarıyla yapılır.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

from _ortak import font, metadata


def strip(video, target, times):
    capture = cv2.VideoCapture(str(video))
    sheet = Image.new('RGB', (1920, 300), '#10191f')
    draw = ImageDraw.Draw(sheet)
    try:
        for index, time in enumerate(times):
            capture.set(cv2.CAP_PROP_POS_MSEC, time * 1000)
            ok, pixels = capture.read()
            if not ok:
                raise RuntimeError(f'Örnek karesi okunamadı: {video}, {time}')
            image = Image.fromarray(cv2.cvtColor(pixels, cv2.COLOR_BGR2RGB))
            sheet.paste(image.resize((480, 270)), (480 * index, 0))
            draw.text((480 * index + 10, 274), f'{time:.3f} sn', font=font(None, 18), fill='white')
    finally:
        capture.release()
    ok, encoded = cv2.imencode('.jpg', cv2.cvtColor(np.asarray(sheet), cv2.COLOR_RGB2BGR),
                               [cv2.IMWRITE_JPEG_QUALITY, 93])
    if not ok:
        raise RuntimeError('JPEG kodlanamadı')
    Path(target).write_bytes(encoded.tobytes())


def verify(video):
    info = metadata(video)
    stream = next(s for s in info['streams'] if s['codec_type'] == 'video')
    assert (stream['width'], stream['height'], stream['pix_fmt']) == (1920, 1080, 'yuv420p')
    assert stream['r_frame_rate'] == '30/1'
    subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(video),
                    '-f', 'null', '-'], check=True, capture_output=True)
    return {'boyut': [1920, 1080], 'fps': 30, 'piksel': stream['pix_fmt'],
            'sure': float(stream['duration']), 'kare': int(stream['nb_frames']),
            'tam_cozumleme': True}


def run(root, only=None):
    entries = json.loads((root/'kurgu/efektler/KATALOG.json').read_text(encoding='utf8'))
    report_path = root/'cikti/efekt-ornek/TEST-SONUCLARI.json'
    report = json.loads(report_path.read_text(encoding='utf8')) if report_path.exists() else {}
    for entry in entries:
        name = entry['ad']
        if entry['kaynak'] != 'kutuphane' or (only and name not in only):
            continue
        args = [sys.executable, '-X', 'utf8', str(root/f'kurgu/efektler/{name}.py')]
        args.extend(entry['test_argumanlari'])
        print(name, flush=True)
        subprocess.run(args, cwd=root, check=True)
        video = root/f'cikti/efekt-ornek/video/{name}.mp4'
        result = verify(video)
        duration = result['sure']
        times = entry.get('ornek_zamanlari') or [duration*f for f in (.2, .4, .6, .8)]
        strip(video, root/entry['ornek'], times)
        result['ornek_zamanlari'] = times
        result['komut'] = args[1:]
        report[name] = result
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--kok', type=Path, required=True)
    cli.add_argument('--yalniz', nargs='+')
    args = cli.parse_args()
    run(args.kok.resolve(), args.yalniz)
