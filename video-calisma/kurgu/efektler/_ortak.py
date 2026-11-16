"""Efektlerin ortak video G/Ç, doğrulama ve Unicode çizim araçları.

Gereksinimler: Python 3.10+, numpy, opencv-python, Pillow ve PATH üzerinde
ffmpeg/ffprobe. Efekt çıktıları sessiz kurgu parçalarıdır.
"""
import argparse
from functools import lru_cache
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

W, H, FPS = 1920, 1080, 30


def ease(value):
    value = float(np.clip(value, 0, 1))
    return value * value * (3 - 2 * value)


def fit(image, size=None):
    size = size or (W, H)
    return ImageOps.fit(image, size, method=Image.Resampling.BICUBIC)


def zoom(image, factor, center=(.5, .5)):
    width, height = image.size
    cw, ch = width / factor, height / factor
    x = np.clip(center[0] * width - cw / 2, 0, width - cw)
    y = np.clip(center[1] * height - ch / 2, 0, height - ch)
    return image.crop((x, y, x + cw, y + ch)).resize(image.size, Image.Resampling.BICUBIC)


@lru_cache(maxsize=128)
def font(path, size):
    candidates = [path] if path else [
        'C:/Windows/Fonts/segoeuib.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/System/Library/Fonts/Supplemental/Arial.ttf',
    ]
    for candidate in candidates:
        if Path(candidate).is_file():
            return ImageFont.truetype(str(candidate), size)
    raise ValueError('Türkçe destekli TTF dosyasını --font ile belirtin')


def shadow(layer, opacity=1):
    alpha = layer.getchannel('A')
    shade = Image.new('RGBA', layer.size)
    shade.putalpha(alpha.filter(ImageFilter.GaussianBlur(3)).point(lambda x: round(x * .8)))
    result = Image.new('RGBA', layer.size)
    result.alpha_composite(shade, (2, 4))
    result.alpha_composite(layer)
    result.putalpha(result.getchannel('A').point(lambda x: round(x * np.clip(opacity, 0, 1))))
    return result


def text_layer(text, args, progress=1, rise=0, tracking=0, mask=False):
    layer = Image.new('RGBA', (W, H))
    draw = ImageDraw.Draw(layer)
    size = args.boyut
    face = font(args.font, size)
    lines = text.splitlines() or ['']
    available = W - args.x - 80
    def line_width(line):
        return face.getlength(line) + tracking * max(0, len(line) - 1)
    while max(map(line_width, lines)) > available and size > 12:
        size -= 1
        face = font(args.font, size)
    if max(map(line_width, lines)) > available:
        raise ValueError('Başlık kadraja sığmıyor. Metni kısaltın veya --x değerini azaltın')
    for row, line in enumerate(lines):
        x = float(args.x)
        for index, char in enumerate(line):
            local = ease((progress - index * .006) / max(.05, .4 - index * .006))
            # Baseline anchoring keeps İ/Ğ and all accented capitals aligned.
            y = args.y + row * size * 1.2 + rise * (1 - local)
            draw.text((round(x), round(y)), char, font=face, fill=args.renk, anchor='ls')
            x += face.getlength(char) + tracking * min(1, progress / .4)
    if mask:
        alpha = np.asarray(layer.getchannel('A')).copy()
        alpha[:max(0, args.y - size - 24)] = 0
        alpha[min(H, round(args.y + (len(lines) - 1) * size * 1.2 + 12)):] = 0
        layer.putalpha(Image.fromarray(alpha))
    return layer


def light(image, mask, color=(255, 231, 195), strength=.15):
    pixels = np.asarray(image).astype(np.float32)
    glow = np.asarray(mask, dtype=np.float32)[..., None] * np.array(color, np.float32) * strength
    return Image.fromarray(np.clip(pixels + glow, 0, 255).astype(np.uint8))


def metadata(path):
    result = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format',
                             '-of', 'json', str(path)], capture_output=True, check=True)
    return json.loads(result.stdout)


class Reader:
    def __init__(self, path, start, count, extra_filter='', scale_only=False):
        info = metadata(path)
        stream = next(s for s in info['streams'] if s['codec_type'] == 'video')
        duration = float(stream.get('duration', info['format'].get('duration', 0)))
        if start < 0 or duration + 1 / FPS < start + count / FPS:
            raise ValueError(f'Kaynak süresi yetersiz: {path}, başlangıç {start}, gereken {count/FPS:.3f} sn')
        self.log = tempfile.TemporaryFile()
        video_filter = f'scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},setsar=1'
        if scale_only:
            video_filter = f'scale={W}:{H}:flags=lanczos,fps={FPS},setsar=1'
        if extra_filter:
            video_filter += ',' + extra_filter.rstrip(',')
        self.proc = subprocess.Popen(['ffmpeg', '-v', 'error', '-threads', '2', '-ss', str(start),
            '-i', str(path), '-an', '-vf', video_filter,
            '-frames:v', str(count), '-threads', '2', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
            stdout=subprocess.PIPE, stderr=self.log)

    def read(self):
        raw = self.proc.stdout.read(W * H * 3)
        if len(raw) != W * H * 3:
            self.log.seek(0)
            raise RuntimeError('Kaynak erken bitti. ' + self.log.read().decode('utf8', 'replace')[-1500:])
        return Image.frombytes('RGB', (W, H), raw)

    def close(self):
        self.proc.stdout.close()
        if self.proc.poll() is None:
            self.proc.terminate()
        self.proc.wait()
        self.log.close()


def parser(kind, description):
    cli = argparse.ArgumentParser(description=description)
    if kind == 'gecis':
        cli.add_argument('--a', required=True)
        cli.add_argument('--b', required=True)
        cli.add_argument('--a-bas', type=float, default=0)
        cli.add_argument('--b-bas', type=float, default=0)
    elif kind == 'yazi':
        cli.add_argument('--video', required=True)
        cli.add_argument('--metin', required=True)
        cli.add_argument('--bas', type=float, required=True)
        cli.add_argument('--bitis', type=float, required=True)
    else:
        cli.add_argument('--girdi', required=True, nargs='+' if kind == 'kompozisyon' else None)
        cli.add_argument('--kaynak-bas', type=float, default=0)
    cli.add_argument('-o', required=True)
    cli.add_argument('--genislik', type=int, default=1920)
    cli.add_argument('--yukseklik', type=int, default=1080)
    cli.add_argument('--yalnizca-olcekle', action='store_true')
    cli.add_argument('--sure', type=float, default=None if kind == 'yazi' else 3)
    cli.set_defaults(font=None, boyut=80, siddet=1)
    if kind in ('yazi', 'kapanis'):
        cli.add_argument('--font', help='Türkçe glifleri bulunan TTF/OTF dosyası')
    if kind == 'yazi':
        cli.add_argument('--boyut', type=int, default=80)
        cli.add_argument('--x', type=int, default=110)
        cli.add_argument('--y', type=int, default=820, help='Yazının taban çizgisi')
        cli.add_argument('--renk', default='#ECECEC')
    if kind == 'isik':
        cli.add_argument('--siddet', type=float, default=1)
    return cli


def main(render, kind, description, configure=None, minimum=1/FPS):
    global W, H
    cli = parser(kind, description)
    if configure:
        configure(cli)
    args = cli.parse_args()
    if min(args.genislik, args.yukseklik) < 2 or args.genislik % 2 or args.yukseklik % 2:
        cli.error('Genişlik ve yükseklik pozitif çift sayı olmalı')
    W, H = args.genislik, args.yukseklik
    render.__globals__.update(W=W, H=H)
    readers = []
    encoder = None
    temporary = None
    try:
        if kind == 'yazi':
            if not 0 <= args.bas < args.bitis:
                raise ValueError('--bas < --bitis ve --bas >= 0 olmalı')
            if args.sure is None:
                info = metadata(args.video)
                stream = next(s for s in info['streams'] if s['codec_type'] == 'video')
                args.sure = float(stream.get('duration', info['format']['duration']))
            if args.bitis > args.sure:
                raise ValueError('--bitis video/çıktı süresini aşamaz')
            paths, starts = [args.video], [0]
        elif kind == 'gecis':
            paths, starts = [args.a, args.b], [args.a_bas, args.b_bas]
        else:
            paths = args.girdi if isinstance(args.girdi, list) else [args.girdi]
            starts = [args.kaynak_bas] * len(paths)
        if not math.isfinite(args.sure) or args.sure < minimum:
            raise ValueError(f'--sure en az {minimum:g} sn olmalı')
        if not math.isfinite(args.siddet) or not 0 <= args.siddet <= 3:
            raise ValueError('--siddet 0–3 aralığında olmalı')
        if not 8 <= args.boyut <= 300:
            raise ValueError('--boyut 8–300 aralığında olmalı')
        target = Path(args.o).resolve()
        if target in [Path(p).resolve() for p in paths]:
            raise ValueError('Çıktı için ayrı bir dosya yolu verin')
        target.parent.mkdir(parents=True, exist_ok=True)
        count = max(1, round(args.sure * FPS))
        args.sure = count / FPS
        readers = []
        for index, (path, start) in enumerate(zip(paths, starts)):
            extra_filter = getattr(render, 'girdi_filtre', '')
            if index == 0 and getattr(args, 'ters_ilk', False):
                extra_filter = f'trim=duration={args.sure},reverse,setpts=PTS-STARTPTS'
            readers.append(Reader(path, start, count, extra_filter, args.yalnizca_olcekle))
        fd, temporary = tempfile.mkstemp(suffix='.mp4', dir=target.parent)
        os.close(fd)
        with tempfile.TemporaryFile() as log:
            encoder = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo',
                '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-an',
                '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '18',
                '-pix_fmt', 'yuv420p', '-movflags', '+faststart', temporary], stdin=subprocess.PIPE, stderr=log)
            state = {}
            for index in range(count):
                frames = [reader.read() for reader in readers]
                progress = index / max(1, count - 1)
                args.t = index / FPS
                image = render(frames, progress, args, state).convert('RGB')
                if image.size != (W, H):
                    raise ValueError(f'Efekt {W}×{H} kare döndürmeli')
                encoder.stdin.write(image.tobytes())
            encoder.stdin.close()
            if encoder.wait():
                log.seek(0)
                raise RuntimeError(log.read().decode('utf8', 'replace')[-2000:])
        os.replace(temporary, target)
        temporary = None
        print(f'{target} · {count} kare · {args.sure:.3f} sn')
    except (ValueError, RuntimeError, subprocess.CalledProcessError, OSError) as error:
        cli.exit(1, f'Hata: {error}\n')
    finally:
        for reader in readers:
            reader.close()
        if encoder and encoder.poll() is None:
            encoder.terminate()
            encoder.wait()
        if temporary and Path(temporary).exists():
            Path(temporary).unlink()
