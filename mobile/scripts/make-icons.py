#!/usr/bin/env python3
"""
Renders every app icon from the transparent master logo (client/public/icons/Oruinwan-mark.png).

Light is the default look (ivory tile, the gold/black logo). Where the system can follow the
device's appearance it gets the other versions too:
  Android  adaptive icon (light) + monochrome layer for themed icons (Android 13+)
  iOS      light, dark and tinted app icons (iOS 18+ picks by the home-screen appearance)
  desktop  icon.png (light, used for the installers) + icon-dark.png (the dock/taskbar
           switches to it while the app is in dark mode, see desktop/electron/main.js)
  web      favicon, PWA icons (incl. maskable) and the phone app's favicon

Needs Pillow: python3 -m pip install pillow   Run: python3 mobile/scripts/make-icons.py
"""
import os
from PIL import Image, ImageDraw, ImageOps

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MASTER = os.path.join(ROOT, 'client/public/icons/Oruinwan-mark.png')
RES = os.path.join(ROOT, 'mobile/android/app/src/main/res')
IOS = os.path.join(ROOT, 'mobile/ios/App/App/Assets.xcassets')

# Light tile: ivory at the top, warm sand at the bottom (the app's 60/30 colours).
LIGHT_TOP, LIGHT_BOTTOM = (251, 248, 243), (236, 226, 208)
DARK_TOP, DARK_BOTTOM = (24, 22, 19), (10, 10, 10)

mark = Image.open(MASTER).convert('RGBA')


def gradient(size, top, bottom):
    w, h = size
    g = Image.new('RGBA', (1, h))
    for y in range(h):
        t = y / max(h - 1, 1)
        g.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)) + (255,))
    return g.resize((w, h))


def logo(px):
    return mark.resize((px, px), Image.LANCZOS)


def place(canvas, px):
    m = logo(px)
    canvas.alpha_composite(m, ((canvas.width - px) // 2, (canvas.height - px) // 2))
    return canvas


def tile(size, art_ratio, top, bottom):
    return place(gradient((size, size), top, bottom), round(size * art_ratio))


def rounded(img, radius_ratio):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radius=round(img.width * radius_ratio), fill=255)
    out = img.copy()
    out.putalpha(Image.composite(img.getchannel('A'), Image.new('L', img.size, 0), mask))
    return out


def circle(img):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, img.width - 1, img.height - 1), fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


def silhouette(px):
    """White logo shapes on transparent (the glow left out), for Android themed icons."""
    a = logo(px).getchannel('A').point(lambda v: 255 if v > 150 else 0)
    out = Image.new('RGBA', (px, px), (255, 255, 255, 0))
    out.putalpha(a)
    return out


def save(img, path, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, **kw)


# ── Android ───────────────────────────────────────────────────────────────────
LEGACY = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
LAYER = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
for d, l in LEGACY.items():
    a = LAYER[d]
    folder = os.path.join(RES, f'mipmap-{d}')
    # Adaptive layers (Android 8+): the art fits the 66dp safe circle of the 108dp layer.
    fg = Image.new('RGBA', (a, a), (0, 0, 0, 0))
    save(place(fg, round(a * 0.586)), os.path.join(folder, 'ic_launcher_foreground.png'))
    save(gradient((a, a), LIGHT_TOP, LIGHT_BOTTOM).convert('RGB'), os.path.join(folder, 'ic_launcher_background.png'))
    mono = Image.new('RGBA', (a, a), (255, 255, 255, 0))
    s = silhouette(round(a * 0.56))
    mono.alpha_composite(s, ((a - s.width) // 2, (a - s.height) // 2))
    save(mono, os.path.join(folder, 'ic_launcher_monochrome.png'))
    # Legacy square and round icons (Android 7).
    base = tile(l, 0.78, LIGHT_TOP, LIGHT_BOTTOM)
    save(rounded(base, 0.22), os.path.join(folder, 'ic_launcher.png'))
    save(circle(base), os.path.join(folder, 'ic_launcher_round.png'))

# Launch screen logo for Android 11 and older: just the logo, on the light or dark splash colour.
splash = Image.new('RGBA', (504, 504), (0, 0, 0, 0))
save(place(splash, 430), os.path.join(RES, 'drawable-nodpi/splash_logo.webp'), quality=88)

# ── iOS ───────────────────────────────────────────────────────────────────────
icon = os.path.join(IOS, 'AppIcon.appiconset')
save(tile(1024, 0.70, LIGHT_TOP, LIGHT_BOTTOM).convert('RGB'), os.path.join(icon, 'AppIcon-512@2x.png'))
# Dark: Apple asks for a transparent background; the system draws its own dark backdrop.
save(place(Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)), 717), os.path.join(icon, 'AppIcon-dark.png'))
# Tinted: a grayscale image the system colours with the user's tint.
gray = ImageOps.grayscale(tile(1024, 0.70, (0, 0, 0), (0, 0, 0)).convert('RGB'))
save(ImageOps.autocontrast(gray), os.path.join(icon, 'AppIcon-tinted.png'))

splash_dir = os.path.join(IOS, 'Splash.imageset')
light_launch = tile(2732, 0.205, (248, 245, 240), (248, 245, 240)).convert('RGB')
dark_launch = tile(2732, 0.205, (12, 12, 12), (12, 12, 12)).convert('RGB')
for suffix in ('', '-1', '-2'):
    save(light_launch, os.path.join(splash_dir, f'splash-2732x2732{suffix}.png'))
    save(dark_launch, os.path.join(splash_dir, f'splash-2732x2732-dark{suffix}.png'))

# ── Desktop (electron-builder makes .icns/.ico from icon.png) ────────────────
# macOS layout: an 824px rounded square centred on a transparent 1024px canvas.
for name, top, bottom in (('icon.png', LIGHT_TOP, LIGHT_BOTTOM), ('icon-dark.png', DARK_TOP, DARK_BOTTOM)):
    canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    t = rounded(tile(824, 0.78, top, bottom), 0.225)
    canvas.alpha_composite(t, (100, 100))
    save(canvas, os.path.join(ROOT, 'desktop/assets', name))

# ── Web ───────────────────────────────────────────────────────────────────────
pub = os.path.join(ROOT, 'client/public')
for px, path in ((192, 'icons/oruinwan-192.png'), (512, 'icons/oruinwan-512.png'), (192, 'icons/icon-192.png'), (512, 'icons/icon-512.png')):
    save(tile(px, 0.70, LIGHT_TOP, LIGHT_BOTTOM).convert('RGB'), os.path.join(pub, path))
# Maskable (Android home screens crop to a circle or squircle): the logo inside the safe zone.
save(tile(512, 0.56, LIGHT_TOP, LIGHT_BOTTOM).convert('RGB'), os.path.join(pub, 'icons/oruinwan-maskable-512.png'))
fav = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
place(fav, 256)
save(fav.resize((64, 64), Image.LANCZOS), os.path.join(pub, 'favicon.png'))
fav.save(os.path.join(pub, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
save(tile(192, 0.70, LIGHT_TOP, LIGHT_BOTTOM).convert('RGB'), os.path.join(ROOT, 'mobile/public/icon-192.png'))

print('Icons written for Android, iOS, desktop and web.')
