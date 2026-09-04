"""
Заменяет светлый/цветной фон товарных фото на цвет сайта (#FFFFFF).
Использование:
  python tools_debg.py <входной_файл> <выходной_файл> [thresh]
  python tools_debg.py --batch  (обработать все фото в images/, кроме images/brands/)
"""
import os
import sys
from PIL import Image, ImageDraw

TARGET = (255, 255, 255)  # #FFFFFF - фон сайта
THRESH = 30


def replace_bg(path, out_path=None, target=TARGET, thresh=THRESH):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    step = max(4, min(w, h) // 40)
    seeds = set()
    for x in range(0, w, step):
        seeds.add((x, 0)); seeds.add((x, h - 1))
    for y in range(0, h, step):
        seeds.add((0, y)); seeds.add((w - 1, y))
    for sx, sy in seeds:
        ImageDraw.floodfill(im, (sx, sy), target, thresh=thresh)
    im.save(out_path or path, quality=92)


def batch(folder):
    count = 0
    for name in sorted(os.listdir(folder)):
        path = os.path.join(folder, name)
        if os.path.isdir(path) or name.startswith('_'):
            continue
        if os.path.splitext(name)[1].lower() not in ('.jpg', '.jpeg', '.png'):
            continue
        try:
            replace_bg(path)
            count += 1
            print('ok', name)
        except Exception as e:
            print('FAIL', name, e)
    print('TOTAL', count)


if __name__ == '__main__':
    if len(sys.argv) >= 2 and sys.argv[1] == '--batch':
        batch(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'images'))
    else:
        src, dst = sys.argv[1], sys.argv[2]
        thresh = int(sys.argv[3]) if len(sys.argv) > 3 else THRESH
        replace_bg(src, dst, thresh=thresh)
        print('done', dst)
