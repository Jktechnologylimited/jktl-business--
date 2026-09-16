"""Generate JKTL Business icons: the real JKTL logo mark, cropped to its
content and centered on a rounded brand-green square (matching the app's
in-app JktlMark component)."""
from PIL import Image, ImageDraw
import os

INK_TEAL = (15, 110, 92, 255)  # brand primary — the "green box"
HERE = os.path.dirname(__file__)
OUT_DIR = os.path.join(HERE, "..", "public")
SOURCE_LOGO = os.path.join(HERE, "brand", "jktl-logo-source.png")


def load_cropped_logo(padding_ratio=0.06):
    """Crop the source logo to its non-transparent content, plus a little
    breathing room, so it isn't off-center on a square canvas."""
    img = Image.open(SOURCE_LOGO).convert("RGBA")
    alpha = img.split()[3]
    bbox = alpha.getbbox()
    cropped = img.crop(bbox)
    w, h = cropped.size
    side = int(max(w, h) * (1 + padding_ratio * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(cropped, ((side - w) // 2, (side - h) // 2), cropped)
    return canvas


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def make_icon(size, radius_ratio, path, logo_scale=0.72, rounded=True):
    bg = Image.new("RGBA", (size, size), INK_TEAL)
    if rounded:
        bg.putalpha(rounded_mask(size, int(size * radius_ratio)))
    logo = load_cropped_logo()
    target = int(size * logo_scale)
    logo = logo.resize((target, target), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(bg, (0, 0), bg if rounded else None)
    if not rounded:
        canvas = bg
    canvas.paste(logo, ((size - target) // 2, (size - target) // 2), logo)
    canvas.save(path)


def make_logo_only(path, size=512):
    """Transparent-background logo, for in-app use over the app's own
    colored container (JktlMark component)."""
    logo = load_cropped_logo(padding_ratio=0.0)
    logo = logo.resize((size, size), Image.LANCZOS)
    logo.save(path)


def make_favicon(path, size=64):
    make_icon(size, 0.22, path, logo_scale=0.74)


os.makedirs(OUT_DIR, exist_ok=True)
make_icon(192, 0.22, os.path.join(OUT_DIR, "icon-192.png"))
make_icon(512, 0.22, os.path.join(OUT_DIR, "icon-512.png"))
make_icon(180, 0.22, os.path.join(OUT_DIR, "apple-touch-icon.png"))
make_icon(512, 0, os.path.join(OUT_DIR, "icon-512-maskable.png"), logo_scale=0.56, rounded=False)
make_favicon(os.path.join(OUT_DIR, "favicon.png"))
make_logo_only(os.path.join(OUT_DIR, "jktl-logo.png"))
print("Icons written to", OUT_DIR)
