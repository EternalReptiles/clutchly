#!/usr/bin/env python3
"""Make the app icon, Android adaptive icon, splash image, favicon and login logo from your logo.

Usage:  python3 scripts/make_icons.py [assets/logo.png] [assets/mark.png]
  logo.png  full logo (snake + wordmark). Used on the login screen.
  mark.png  optional: the snake on its own. Used for the icon and splash, where a wordmark would be
            too small to read. Without it, logo.png is used for everything.
Black-on-white or black-on-transparent artwork both work: the linework becomes ink (#141414) on transparent.
Needs Pillow (pip install pillow). Run it again whenever the logo changes, then commit assets/.
"""
import sys
from pathlib import Path
from PIL import Image, ImageOps

INK, CREAM = (0x14, 0x14, 0x14), (0xfc, 0xfc, 0xf8)
ASSETS = Path(__file__).resolve().parent.parent / 'assets'

def ink_art(path):
    """Load artwork and return it as ink-coloured linework on transparent, trimmed to its edges."""
    im = Image.open(path).convert('RGBA')
    has_alpha = im.getchannel('A').getextrema()[0] < 250
    dark = ImageOps.invert(im.convert('L'))  # dark lines -> high values
    alpha = Image.composite(dark, Image.new('L', im.size, 0), im.getchannel('A')) if has_alpha else dark
    alpha = alpha.point(lambda v: 0 if v < 12 else min(255, int(v * 1.08)))  # drop paper texture / near-white noise
    out = Image.new('RGBA', im.size, INK + (0,)); out.putalpha(alpha)
    box = alpha.getbbox()
    if not box: sys.exit(f'{path}: no dark linework found')
    return out.crop(box)

def place(art, size, frac, bg=None):
    """Centre art inside a size x size canvas, fitting within frac of the side."""
    canvas = Image.new('RGBA', (size, size), (bg + (255,)) if bg else (0, 0, 0, 0))
    scale = min(size * frac / art.width, size * frac / art.height)
    a = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.LANCZOS)
    canvas.alpha_composite(a, ((size - a.width) // 2, (size - a.height) // 2))
    return canvas

def main():
    logo = Path(sys.argv[1]) if len(sys.argv) > 1 else ASSETS / 'logo.png'
    mark = Path(sys.argv[2]) if len(sys.argv) > 2 else ASSETS / 'mark.png'
    full = ink_art(logo)
    m = ink_art(mark) if mark.exists() else full
    ASSETS.mkdir(exist_ok=True)
    # Login screen: full logo, max 1200px wide, transparent.
    lg = full.copy(); lg.thumbnail((1200, 1200), Image.LANCZOS); lg.save(ASSETS / 'logo-ink.png', optimize=True)
    # iOS / store icon: opaque, cream background (iOS adds its own rounded corners).
    place(m, 1024, 0.74, CREAM).convert('RGB').save(ASSETS / 'icon.png', optimize=True)
    # Android adaptive icon foreground: transparent, inside the 66% safe zone; background colour set in app.json.
    place(m, 1024, 0.56).save(ASSETS / 'adaptive-icon.png', optimize=True)
    # Splash: mark on transparent; expo-splash-screen centres it on the cream background.
    place(m, 1024, 0.96).save(ASSETS / 'splash-icon.png', optimize=True)
    # Web favicon.
    place(m, 48, 0.9, CREAM).save(ASSETS / 'favicon.png', optimize=True)
    print('Wrote', ', '.join(p.name for p in sorted(ASSETS.glob('*.png'))))

if __name__ == '__main__':
    main()
