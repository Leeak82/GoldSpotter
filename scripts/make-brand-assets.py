"""Draw GoldSpotter icons, the Open Graph card, and a README preview."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ICONS = PUBLIC / "icons"
BG = (16, 14, 11, 255)
GOLD = (231, 194, 122, 255)
GOLD_2 = (240, 193, 75, 255)
AMBER = (227, 148, 58, 255)
INK = (247, 242, 234, 255)
MUTED = (179, 167, 148, 255)
BOARD = (20, 48, 36, 255)

SERIF = "/usr/share/fonts/truetype/noto/NotoSerif-Bold.ttf"
SANS = "/usr/share/fonts/truetype/macos/Inter-Medium.ttf"
SANS_BOLD = "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def rounded(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def mark(draw: ImageDraw.ImageDraw, x, y, s):
    rounded(draw, (x, y, x + s, y + s), int(s * 0.22), BG, GOLD, max(2, s // 48))
    pad = int(s * 0.22)
    rounded(draw, (x + pad, y + pad * 0.8, x + s - pad, y + s * 0.72), int(s * 0.08), (26, 22, 17, 255), (141, 106, 50, 255), max(1, s // 80))
    draw.rectangle((x + pad + s * 0.06, y + pad, x + pad + s * 0.28, y + pad + s * 0.08), fill=GOLD_2)
    draw.rectangle((x + pad + s * 0.34, y + pad, x + s - pad - s * 0.06, y + pad + s * 0.08), fill=AMBER)
    draw.line((x + pad, y + s * 0.84, x + s - pad, y + s * 0.84), fill=GOLD, width=max(2, s // 40))


def icon(size: int, pad_ratio: float = 0.12) -> Image.Image:
    image = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(image)
    inset = int(size * pad_ratio)
    mark(draw, inset, inset, size - inset * 2)
    return image


def og() -> Image.Image:
    image = Image.new("RGBA", (1200, 630), BG)
    draw = ImageDraw.Draw(image)
    draw.ellipse((-80, -160, 520, 420), fill=(231, 194, 122, 36))
    mark(draw, 78, 150, 220)
    draw.text((340, 150), "GoldSpotter", font=font(SERIF, 86), fill=INK)
    draw.text((340, 270), "See the likely gold on a circuit board.", font=font(SANS, 36), fill=MUTED)
    draw.text((340, 470), "goldspotter.onrender.com", font=font(SANS_BOLD, 28), fill=GOLD)
    board = (760, 120, 1120, 520)
    rounded(draw, board, 28, BOARD)
    draw.rectangle((800, 180, 900, 230), outline=GOLD_2, width=4)
    draw.rectangle((930, 190, 1060, 250), outline=AMBER, width=4)
    draw.rectangle((800, 400, 1080, 450), fill=GOLD_2)
    return image


def screenshot() -> Image.Image:
    image = Image.new("RGBA", (1200, 760), BG)
    draw = ImageDraw.Draw(image)
    draw.text((70, 48), "GoldSpotter", font=font(SERIF, 42), fill=INK)
    phone = (360, 40, 840, 720)
    rounded(draw, phone, 36, (20, 17, 13, 255), (231, 194, 122, 80), 2)
    board = (400, 110, 800, 430)
    rounded(draw, board, 18, BOARD)
    draw.rectangle((430, 150, 560, 210), outline=GOLD_2, width=4)
    draw.text((436, 158), "CPU", font=font(SANS_BOLD, 18), fill=(26, 18, 6, 255))
    draw.rectangle((430, 150, 500, 178), fill=GOLD_2)
    draw.rectangle((600, 160, 760, 230), outline=AMBER, width=4)
    draw.rectangle((430, 360, 770, 400), fill=GOLD_2)
    draw.text((430, 470), "B  ·  RAM stick", font=font(SERIF, 32), fill=INK)
    draw.text((430, 520), "Likely gold-bearing candidates.", font=font(SANS, 22), fill=MUTED)
    draw.text((430, 620), "Provisional category, not a price.", font=font(SANS, 18), fill=GOLD)
    return image


def main():
    ICONS.mkdir(parents=True, exist_ok=True)
    icon(192, 0.1).save(ICONS / "icon-192.png")
    icon(512, 0.1).save(ICONS / "icon-512.png")
    icon(512, 0.22).save(ICONS / "icon-maskable-512.png")
    icon(180, 0.08).save(ICONS / "apple-touch-icon.png")
    icon(32, 0.06).save(ICONS / "favicon-32.png")
    og().convert("RGB").save(PUBLIC / "og.png", quality=92)
    screenshot().convert("RGB").save(PUBLIC / "screenshot.png", quality=92)


if __name__ == "__main__":
    main()
