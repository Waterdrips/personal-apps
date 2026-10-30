"""Generates placeholder PNG icons (letter on the app colour) for every app in apps.json.
Replace <app>/public/icons/*.png with real artwork whenever you like."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
registry = json.loads((root / "apps.json").read_text())


def font(size):
    for path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ]:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


for app in registry["apps"]:
    out = root / app["id"] / "public" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        img = Image.new("RGB", (size, size), app["theme_color"])
        draw = ImageDraw.Draw(img)
        f = font(int(size * 0.5))
        draw.text((size / 2, size / 2), app["letter"], fill="white", font=f, anchor="mm")
        img.save(out / f"icon-{size}.png")
    print("icons:", app["id"])
