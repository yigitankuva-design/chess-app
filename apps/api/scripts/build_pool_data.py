"""66 tohum ikonunu üretip scripts/pool-images-data.json'a yazar.

Calistirma: python -m scripts.build_pool_data

Ikonlar iki teknikle uretilir:
  1. Sekil tabanli (SVG primitifleri)  — tarayici bagimsiz, kesin calisir
  2. Glif tabanli (<text> icinde karakter) — satranc tasi/harf/rakam icin
     standart Unicode karakterler, emoji kategorileri icin emoji karakterler

SVG'ler ;base64, ile gomulur, ;utf8, ile DEGIL: renk kodlarindaki '#'
karakteri utf8 data-URI'de fragment baslangici sayilir ve gorsel sessizce
bozulur.

"Satranc Sampiyonlari" kategorisi KASTEN bostur — gercek kisi fotografi telif
riski tasir, uydurulmaz (KURAL #1). Zafer Hoca kendisi ekler.
"""
import base64
import json
from pathlib import Path

OUT = Path(__file__).parent / "pool-images-data.json"

CARD = '<rect width="64" height="64" rx="8" fill="#f4f4f5"/>'


def _svg(body: str, color: str = "#334155") -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        f'{CARD}<g fill="{color}">{body}</g></svg>'
    )


def _uri(svg: str) -> str:
    b64 = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{b64}"


def _board(n: int) -> str:
    """n x n dama deseni — beyaz zemin, koyu kareler grup renginden."""
    cell = 48 // n
    parts = ['<rect x="8" y="8" width="48" height="48" fill="#ffffff"/>']
    for r in range(n):
        for c in range(n):
            if (r + c) % 2 == 1:
                parts.append(
                    f'<rect x="{8 + c * cell}" y="{8 + r * cell}" '
                    f'width="{cell}" height="{cell}"/>'
                )
    return "".join(parts)


def _glyph(ch: str, size: int = 40) -> str:
    """Bir karakteri ikon olarak ortalar. Satranc tasi/harf/rakam/emoji icin."""
    return (
        f'<text x="32" y="{32 + size // 3}" font-size="{size}" '
        f'text-anchor="middle" font-family="serif">{ch}</text>'
    )


SHAPES: list[tuple[str, str]] = [
    ("Geometrik Şekiller", '<circle cx="32" cy="32" r="20"/>'),
    ("Geometrik Şekiller", '<rect x="14" y="14" width="36" height="36"/>'),
    ("Geometrik Şekiller", '<polygon points="32,12 52,50 12,50"/>'),
    ("Geometrik Şekiller", '<polygon points="32,10 54,32 32,54 10,32"/>'),
    ("Geometrik Şekiller", '<polygon points="32,10 51,21 51,43 32,54 13,43 13,21"/>'),
    ("Geometrik Şekiller",
     '<polygon points="32,8 39,26 58,26 43,38 49,56 32,45 15,56 21,38 6,26 25,26"/>'),
    ("Satranç Tahtası", _board(2)),
    ("Satranç Tahtası", _board(4)),
    ("Satranç Tahtası", _board(8)),
    ("Satranç Tahtası",
     '<rect x="16" y="16" width="32" height="32" fill="#ffffff" '
     'stroke="#334155" stroke-width="2"/>'),
    ("Satranç Tahtası", '<rect x="16" y="16" width="32" height="32"/>'),
    ("Satranç Tahtası", _board(2) + '<circle cx="32" cy="32" r="6" fill="#ef4444"/>'),
]

# Standart Unicode satranç/harf/rakam karakterleri — emoji DEĞİL, her fontta var.
GLYPHS: list[tuple[str, str]] = [
    ("Satranç Taşları", "♔"), ("Satranç Taşları", "♕"),
    ("Satranç Taşları", "♖"), ("Satranç Taşları", "♗"),
    ("Satranç Taşları", "♘"), ("Satranç Taşları", "♙"),
    ("Harfler", "A"), ("Harfler", "B"), ("Harfler", "C"),
    ("Harfler", "D"), ("Harfler", "E"), ("Harfler", "F"),
    ("Rakamlar", "1"), ("Rakamlar", "2"), ("Rakamlar", "3"),
    ("Rakamlar", "4"), ("Rakamlar", "5"), ("Rakamlar", "6"),
]

# Emoji kategorileri — hepsi TEK kod noktası (ZWJ birleşimi yok, render riski düşük).
EMOJI: list[tuple[str, str]] = [
    ("Hayvanlar", "\U0001F431"), ("Hayvanlar", "\U0001F436"),
    ("Hayvanlar", "\U0001F981"), ("Hayvanlar", "\U0001F418"),
    ("Hayvanlar", "\U0001F426"), ("Hayvanlar", "\U0001F41F"),
    ("Bitkiler", "\U0001F333"), ("Bitkiler", "\U0001F338"),
    ("Bitkiler", "\U0001F335"), ("Bitkiler", "\U0001F343"),
    ("Bitkiler", "\U0001F33E"), ("Bitkiler", "\U0001F344"),
    ("Taşıtlar", "\U0001F697"), ("Taşıtlar", "\U0001F68C"),
    ("Taşıtlar", "\U0001F686"), ("Taşıtlar", "\U0001F680"),
    ("Taşıtlar", "\U0001F6A2"), ("Taşıtlar", "\U0001F6B2"),
    ("Gezegenler", "\U0001F30D"), ("Gezegenler", "\U0001FA90"),
    ("Gezegenler", "\U0001F315"), ("Gezegenler", "\U0001F319"),
    ("Gezegenler", "\U0001F506"), ("Gezegenler", "\U0001F534"),
    ("Meslekler", "\U0001F46E"), ("Meslekler", "\U0001F477"),
    ("Meslekler", "\U0001FA7A"), ("Meslekler", "\U0001F3A8"),
    ("Meslekler", "\U0001F4DA"), ("Meslekler", "\U0001F373"),
    ("Gök Cisimleri", "⭐"), ("Gök Cisimleri", "\U0001F31F"),
    ("Gök Cisimleri", "\U0001F320"), ("Gök Cisimleri", "\U0001F308"),
    ("Gök Cisimleri", "⚡"), ("Gök Cisimleri", "\U0001F30C"),
]


def build() -> list[dict]:
    rows: list[dict] = []
    for category, body in SHAPES:
        rows.append({"category": category, "data_uri": _uri(_svg(body))})
    for category, ch in GLYPHS + EMOJI:
        rows.append({"category": category, "data_uri": _uri(_svg(_glyph(ch)))})
    return rows


if __name__ == "__main__":
    rows = build()
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(rows)} ikon yazildi -> {OUT}")
