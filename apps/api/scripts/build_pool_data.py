"""Gorsel havuzu tohum ikonlarini uretip scripts/pool-images-data.json'a yazar.

Calistirma: python -m scripts.build_pool_data

TASARIM KARARI — HER SEY VEKTOREL (madde 3c):
Eski surumde hayvan/bitki/tasit/gezegen/meslek ikonlari EMOJI karakteriydi
(<text> icinde). Emoji her cihazda farkli render olur ve gercekte vektorel
degildir — kullanicinin "format cok kotu ve kullanissiz" sikayeti buydu.
Artik bu kategoriler EL ILE CIZILMIS SVG yollaridir: her cihazda ayni,
buyutunce bozulmaz.

TEK BILINCLI ISTISNA — Harfler ve Rakamlar:
Bunlar <text> ile yazilir (yol degil), cunku harf cizmek font tasarlamaktir.
Emoji'den farki: A-Z ve 0-9 temel Latin karakterleridir ve HER fontta vardir.
Cihazdan cihaza kaybolma riski yoktur.

Satranc Taslari: uygulamanin KENDI tas seti (Cburnett, react-chessboard)
scripts/chess-pieces-svg.json'a cikarilmistir — "Konum Ekle'deki motiflerle
ayni olsun" istegi birebir karsilanir, el cizimi taklit YOKTUR.

"Satranc Sampiyonlari" KASTEN bostur — gercek kisi fotografi telif riski
tasir, uydurulmaz (KURAL #1). Zafer Hoca kendisi ekler.

SVG'ler ;base64, ile gomulur, ;utf8, ile DEGIL: renk kodlarindaki '#'
karakteri utf8 data-URI'de fragment baslangici sayilir ve gorsel bozulur.
"""
import base64
import json
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "pool-images-data.json"
PIECES = HERE / "chess-pieces-svg.json"

CARD = '<rect width="64" height="64" rx="8" fill="#f4f4f5"/>'
INK = "#334155"


def _uri(svg: str) -> str:
    b64 = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{b64}"


def _strip_svg_wrapper(svg: str) -> str:
    """En distaki <svg ...> ... </svg> etiketlerini atar, ICERIGI dondurur."""
    start = svg.index(">") + 1
    end = svg.rindex("</svg>")
    return svg[start:end]


def _svg(body: str, color: str = INK) -> str:
    """Tek renkli dolgu ikonu: 64x64 kart + ortalanmis sekil."""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        f'{CARD}<g fill="{color}">{body}</g></svg>'
    )


def _line_svg(body: str, color: str = INK, width: float = 3) -> str:
    """Cizgi (stroke) tabanli ikon — dolgu yok, yuvarlak uclu."""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        f'{CARD}<g fill="none" stroke="{color}" stroke-width="{width}" '
        'stroke-linecap="round" stroke-linejoin="round">'
        f"{body}</g></svg>"
    )


def _glyph_svg(ch: str, size: int = 38) -> str:
    """Harf/rakam ikonu. Temel Latin — her fontta vardir (bkz. modul basligi)."""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        f"{CARD}"
        f'<text x="32" y="{32 + size // 3}" font-size="{size}" '
        f'font-family="Arial,Helvetica,sans-serif" font-weight="700" '
        f'text-anchor="middle" fill="{INK}">{ch}</text></svg>'
    )


# ── Satranc Tahtasi (10) — saf geometri ────────────────────────────────────
def _board(n: int, dark: str = INK) -> str:
    cell = 48 // n
    parts = ['<rect x="8" y="8" width="48" height="48" fill="#ffffff"/>']
    for r in range(n):
        for c in range(n):
            if (r + c) % 2 == 1:
                parts.append(
                    f'<rect x="{8 + c * cell}" y="{8 + r * cell}" '
                    f'width="{cell}" height="{cell}" fill="{dark}"/>'
                )
    parts.append('<rect x="8" y="8" width="48" height="48" fill="none" '
                 f'stroke="{INK}" stroke-width="2"/>')
    return "".join(parts)


def _plain_svg(body: str) -> str:
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
            f"{CARD}{body}</svg>")


BOARDS: list[str] = [
    _board(2),
    _board(4),
    _board(8),
    _board(8, dark="#c3c6ee"),                       # uygulamanin tahta rengi
    # Bos kare (acik)
    '<rect x="16" y="16" width="32" height="32" fill="#ffffff" '
    f'stroke="{INK}" stroke-width="2.5"/>',
    # Dolu kare (koyu)
    f'<rect x="16" y="16" width="32" height="32" fill="{INK}"/>',
    # Vurgulu kare (kirmizi cerceve)
    '<rect x="16" y="16" width="32" height="32" fill="#ffffff" '
    'stroke="#ef4444" stroke-width="4"/>',
    # Hedef isaretli kare
    _board(2) + '<circle cx="32" cy="32" r="7" fill="#ef4444"/>',
    # Tek sutun (dikey serit)
    '<rect x="8" y="8" width="48" height="48" fill="#ffffff"/>'
    f'<rect x="20" y="8" width="12" height="48" fill="{INK}"/>'
    f'<rect x="8" y="8" width="48" height="48" fill="none" stroke="{INK}" stroke-width="2"/>',
    # Tek satir (yatay serit)
    '<rect x="8" y="8" width="48" height="48" fill="#ffffff"/>'
    f'<rect x="8" y="20" width="48" height="12" fill="{INK}"/>'
    f'<rect x="8" y="8" width="48" height="48" fill="none" stroke="{INK}" stroke-width="2"/>',
]

# ── Geometrik Sekiller (6) — degismedi, zaten vektorel ─────────────────────
SHAPES: list[str] = [
    '<circle cx="32" cy="32" r="20"/>',
    '<rect x="14" y="14" width="36" height="36"/>',
    '<polygon points="32,12 52,50 12,50"/>',
    '<polygon points="32,10 54,32 32,54 10,32"/>',
    '<polygon points="32,10 51,21 51,43 32,54 13,43 13,21"/>',
    '<polygon points="32,8 39,26 58,26 43,38 49,56 32,45 15,56 21,38 6,26 25,26"/>',
]

# ── Hayvanlar (20) — el ile cizilmis, sade dolgu ───────────────────────────
ANIMALS: list[str] = [
    # kedi
    '<circle cx="32" cy="36" r="15"/><polygon points="19,26 21,12 31,21"/>'
    '<polygon points="45,26 43,12 33,21"/>',
    # kopek
    '<circle cx="32" cy="36" r="14"/><ellipse cx="17" cy="28" rx="6" ry="11"/>'
    '<ellipse cx="47" cy="28" rx="6" ry="11"/>',
    # tavsan
    '<circle cx="32" cy="40" r="13"/><ellipse cx="26" cy="18" rx="5" ry="13"/>'
    '<ellipse cx="38" cy="18" rx="5" ry="13"/>',
    # ayi
    '<circle cx="32" cy="36" r="16"/><circle cx="18" cy="20" r="7"/>'
    '<circle cx="46" cy="20" r="7"/>',
    # fare
    '<ellipse cx="30" cy="38" rx="15" ry="12"/><circle cx="19" cy="24" r="8"/>'
    '<circle cx="41" cy="24" r="8"/><path d="M45 44 q12 2 12 12 h-4 q0-8-8-9z"/>',
    # kus
    '<ellipse cx="30" cy="34" rx="16" ry="12"/><circle cx="44" cy="24" r="8"/>'
    '<polygon points="52,24 62,27 52,30"/><polygon points="24,44 30,56 36,44"/>',
    # balik
    '<ellipse cx="28" cy="32" rx="18" ry="11"/><polygon points="46,32 60,22 60,42"/>'
    '<circle cx="18" cy="29" r="2.5" fill="#f4f4f5"/>',
    # kaplumbaga
    '<ellipse cx="32" cy="34" rx="17" ry="13"/><circle cx="52" cy="30" r="6"/>'
    '<rect x="16" y="45" width="7" height="8" rx="3"/>'
    '<rect x="41" y="45" width="7" height="8" rx="3"/>',
    # fil
    '<ellipse cx="30" cy="32" rx="17" ry="14"/><circle cx="14" cy="28" r="10"/>'
    '<path d="M46 36 q10 4 8 18 h-6 q2-10-6-13z"/>',
    # aslan (yeleli kafa)
    '<circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="12" fill="#f4f4f5"/>'
    '<circle cx="27" cy="30" r="2.5"/><circle cx="37" cy="30" r="2.5"/>'
    '<circle cx="32" cy="38" r="3"/>',
    # kelebek
    '<ellipse cx="20" cy="26" rx="12" ry="10"/><ellipse cx="44" cy="26" rx="12" ry="10"/>'
    '<ellipse cx="22" cy="42" rx="9" ry="8"/><ellipse cx="42" cy="42" rx="9" ry="8"/>'
    '<rect x="30" y="20" width="4" height="28" rx="2"/>',
    # ari
    '<ellipse cx="32" cy="36" rx="14" ry="11"/>'
    '<rect x="24" y="27" width="5" height="19" fill="#f4f4f5"/>'
    '<rect x="35" y="27" width="5" height="19" fill="#f4f4f5"/>'
    '<ellipse cx="22" cy="20" rx="9" ry="6"/><ellipse cx="42" cy="20" rx="9" ry="6"/>',
    # yilan
    '<path d="M12 46 q10-14 20 0 t20 0" fill="none" stroke="#334155" '
    'stroke-width="7" stroke-linecap="round"/><circle cx="52" cy="26" r="7"/>',
    # kurbaga
    '<ellipse cx="32" cy="40" rx="18" ry="13"/><circle cx="22" cy="22" r="8"/>'
    '<circle cx="42" cy="22" r="8"/><circle cx="22" cy="22" r="3" fill="#f4f4f5"/>'
    '<circle cx="42" cy="22" r="3" fill="#f4f4f5"/>',
    # at (profil)
    '<path d="M20 54 v-18 q0-14 14-16 l6-8 4 6 8 2 -4 8 q4 6 0 12 l-6 14z"/>',
    # inek
    '<ellipse cx="32" cy="38" rx="16" ry="13"/><ellipse cx="32" cy="46" rx="8" ry="6" fill="#f4f4f5"/>'
    '<path d="M14 24 q-4-10 6-10 q4 2 4 8z"/><path d="M50 24 q4-10-6-10 q-4 2-4 8z"/>',
    # koyun
    '<circle cx="24" cy="32" r="10"/><circle cx="34" cy="26" r="10"/>'
    '<circle cx="42" cy="34" r="10"/><circle cx="32" cy="40" r="11"/>'
    '<circle cx="48" cy="44" r="7"/>',
    # penguen
    '<ellipse cx="32" cy="36" rx="14" ry="19"/>'
    '<ellipse cx="32" cy="40" rx="8" ry="13" fill="#f4f4f5"/>'
    '<circle cx="32" cy="18" r="9"/><polygon points="32,22 40,26 32,30" fill="#f59e0b"/>',
    # sincap
    '<ellipse cx="26" cy="40" rx="11" ry="13"/><circle cx="26" cy="22" r="8"/>'
    '<path d="M40 52 q16-4 12-24 q-2-8-10-6 q8 6 4 16 q-3 8-10 10z"/>',
    # yengec
    '<ellipse cx="32" cy="36" rx="15" ry="11"/>'
    '<path d="M14 30 q-8-6-10 2 q6 0 8 4z"/><path d="M50 30 q8-6 10 2 q-6 0-8 4z"/>'
    '<rect x="16" y="46" width="4" height="10" rx="2"/>'
    '<rect x="44" y="46" width="4" height="10" rx="2"/>',
]

# ── Bitkiler (20) ──────────────────────────────────────────────────────────
PLANTS: list[str] = [
    # agac (yuvarlak)
    '<circle cx="32" cy="26" r="16"/><rect x="29" y="38" width="6" height="18" rx="2"/>',
    # cam agaci
    '<polygon points="32,8 46,30 18,30"/><polygon points="32,22 50,46 14,46"/>'
    '<rect x="29" y="46" width="6" height="10" rx="2"/>',
    # cicek (papatya)
    '<circle cx="32" cy="24" r="6"/><circle cx="32" cy="12" r="6"/>'
    '<circle cx="44" cy="24" r="6"/><circle cx="20" cy="24" r="6"/>'
    '<circle cx="32" cy="36" r="6"/><rect x="30" y="34" width="4" height="22" rx="2"/>',
    # gul
    '<circle cx="32" cy="24" r="14"/><circle cx="32" cy="24" r="8" fill="#f4f4f5"/>'
    '<circle cx="32" cy="24" r="4"/><rect x="30" y="36" width="4" height="20" rx="2"/>',
    # lale
    '<path d="M20 20 q4 22 12 22 t12-22 q-6 8-12 2 q-6 6-12-2z"/>'
    '<rect x="30" y="40" width="4" height="16" rx="2"/>',
    # yaprak
    '<path d="M14 50 q0-36 36-36 q0 36-36 36z"/>'
    '<path d="M14 50 L44 20" stroke="#f4f4f5" stroke-width="3" fill="none"/>',
    # kaktus
    '<rect x="27" y="14" width="10" height="42" rx="5"/>'
    '<rect x="12" y="26" width="9" height="18" rx="4.5"/>'
    '<rect x="43" y="20" width="9" height="18" rx="4.5"/>',
    # bugday
    '<rect x="30" y="30" width="4" height="26" rx="2"/>'
    '<ellipse cx="26" cy="16" rx="5" ry="9"/><ellipse cx="38" cy="16" rx="5" ry="9"/>'
    '<ellipse cx="26" cy="28" rx="5" ry="9"/><ellipse cx="38" cy="28" rx="5" ry="9"/>',
    # mantar
    '<path d="M12 32 q0-18 20-18 t20 18z"/>'
    '<rect x="26" y="32" width="12" height="22" rx="4"/>',
    # ayçicegi
    '<circle cx="32" cy="26" r="9"/>'
    '<circle cx="32" cy="12" r="5"/><circle cx="32" cy="40" r="5"/>'
    '<circle cx="18" cy="26" r="5"/><circle cx="46" cy="26" r="5"/>'
    '<circle cx="22" cy="16" r="5"/><circle cx="42" cy="16" r="5"/>'
    '<circle cx="22" cy="36" r="5"/><circle cx="42" cy="36" r="5"/>'
    '<rect x="30" y="42" width="4" height="14" rx="2"/>',
    # saksi cicegi
    '<circle cx="32" cy="20" r="10"/><rect x="30" y="28" width="4" height="12"/>'
    '<path d="M18 40 h28 l-4 16 h-20z"/>',
    # elma
    '<circle cx="24" cy="38" r="13"/><circle cx="40" cy="38" r="13"/>'
    '<rect x="30" y="12" width="4" height="12" rx="2"/>'
    '<path d="M34 16 q10-6 12 2 q-8 4-12-2z"/>',
    # armut
    '<circle cx="32" cy="42" r="14"/><circle cx="32" cy="26" r="9"/>'
    '<rect x="30" y="10" width="4" height="10" rx="2"/>',
    # uzum
    '<circle cx="32" cy="22" r="6"/><circle cx="24" cy="32" r="6"/>'
    '<circle cx="40" cy="32" r="6"/><circle cx="32" cy="40" r="6"/>'
    '<circle cx="24" cy="48" r="6"/><circle cx="40" cy="48" r="6"/>'
    '<rect x="30" y="8" width="4" height="10" rx="2"/>',
    # havuc
    '<polygon points="32,56 22,24 42,24"/>'
    '<ellipse cx="26" cy="16" rx="5" ry="8"/><ellipse cx="38" cy="16" rx="5" ry="8"/>',
    # cimen
    '<path d="M12 54 q4-22 10-26 q-2 16 0 26z"/>'
    '<path d="M28 54 q2-26 8-30 q-2 20-2 30z"/>'
    '<path d="M44 54 q4-20 10-24 q-4 14-4 24z"/>',
    # palmiye
    '<rect x="30" y="30" width="5" height="26" rx="2"/>'
    '<path d="M32 30 q-18-4-22 6 q12-2 22-2z"/>'
    '<path d="M32 30 q18-4 22 6 q-12-2-22-2z"/>'
    '<path d="M32 30 q-8-16 2-22 q6 10 2 22z"/>',
    # tohum/filiz
    '<rect x="30" y="34" width="4" height="22" rx="2"/>'
    '<path d="M32 36 q-16-2-16-14 q14 0 16 14z"/>'
    '<path d="M32 36 q16-2 16-14 q-14 0-16 14z"/>',
    # nilufer
    '<ellipse cx="32" cy="40" rx="20" ry="8"/>'
    '<path d="M32 38 q-12-4-10-16 q10 2 10 16z"/>'
    '<path d="M32 38 q12-4 10-16 q-10 2-10 16z"/>'
    '<path d="M32 38 q0-18 0-20 q4 12 0 20z"/>',
    # kozalak
    '<ellipse cx="32" cy="34" rx="12" ry="20"/>'
    '<path d="M20 30 h24 M20 40 h24 M24 22 h16 M24 48 h16" stroke="#f4f4f5" '
    'stroke-width="3" fill="none"/>',
]

# ── Tasitlar (20) ──────────────────────────────────────────────────────────
VEHICLES: list[str] = [
    # otomobil
    '<path d="M8 40 l6-12 h36 l6 12 v8 h-48z"/>'
    '<circle cx="20" cy="48" r="6" fill="#f4f4f5" stroke="#334155" stroke-width="3"/>'
    '<circle cx="44" cy="48" r="6" fill="#f4f4f5" stroke="#334155" stroke-width="3"/>',
    # otobus
    '<rect x="8" y="16" width="48" height="30" rx="5"/>'
    '<rect x="13" y="21" width="16" height="11" fill="#f4f4f5"/>'
    '<rect x="35" y="21" width="16" height="11" fill="#f4f4f5"/>'
    '<circle cx="20" cy="49" r="5"/><circle cx="44" cy="49" r="5"/>',
    # tren
    '<rect x="10" y="14" width="44" height="30" rx="5"/>'
    '<rect x="16" y="20" width="14" height="12" fill="#f4f4f5"/>'
    '<rect x="34" y="20" width="14" height="12" fill="#f4f4f5"/>'
    '<circle cx="20" cy="49" r="5"/><circle cx="44" cy="49" r="5"/>'
    '<rect x="6" y="44" width="52" height="4" rx="2"/>',
    # roket
    '<path d="M32 6 q12 14 12 30 h-24 q0-16 12-30z"/>'
    '<polygon points="20,36 10,52 20,48"/><polygon points="44,36 54,52 44,48"/>'
    '<circle cx="32" cy="26" r="5" fill="#f4f4f5"/>'
    '<polygon points="26,44 32,58 38,44"/>',
    # gemi
    '<path d="M8 40 h48 l-8 14 h-32z"/>'
    '<rect x="28" y="14" width="4" height="26"/>'
    '<path d="M32 16 h18 l-18 12z"/>',
    # bisiklet
    '<circle cx="16" cy="42" r="11" fill="none" stroke="#334155" stroke-width="4"/>'
    '<circle cx="48" cy="42" r="11" fill="none" stroke="#334155" stroke-width="4"/>'
    '<path d="M16 42 L28 22 h10 l10 20 M28 22 l8 20" fill="none" stroke="#334155" '
    'stroke-width="4" stroke-linecap="round"/>',
    # ucak
    '<path d="M32 6 q5 0 5 14 l20 14 v6 l-20-6 v10 l7 6 v4 l-12-4 -12 4 v-4 l7-6 v-10 '
    'l-20 6 v-6 l20-14 q0-14 5-14z"/>',
    # helikopter
    '<rect x="8" y="14" width="48" height="4" rx="2"/>'
    '<rect x="30" y="18" width="4" height="8"/>'
    '<ellipse cx="28" cy="36" rx="18" ry="11"/>'
    '<path d="M44 34 h14 v6 h-14z"/><rect x="52" y="26" width="4" height="14" rx="2"/>',
    # kamyon
    '<rect x="6" y="22" width="30" height="22" rx="3"/>'
    '<path d="M36 30 h12 l8 10 v4 h-20z"/>'
    '<circle cx="16" cy="48" r="5"/><circle cx="46" cy="48" r="5"/>',
    # traktor
    '<rect x="14" y="22" width="22" height="16" rx="3"/>'
    '<rect x="36" y="30" width="14" height="8" rx="2"/>'
    '<circle cx="20" cy="46" r="10" fill="none" stroke="#334155" stroke-width="5"/>'
    '<circle cx="46" cy="48" r="6" fill="none" stroke="#334155" stroke-width="4"/>',
    # motosiklet
    '<circle cx="14" cy="44" r="9" fill="none" stroke="#334155" stroke-width="4"/>'
    '<circle cx="50" cy="44" r="9" fill="none" stroke="#334155" stroke-width="4"/>'
    '<path d="M14 44 l10-12 h14 l12 12" fill="none" stroke="#334155" stroke-width="4" '
    'stroke-linecap="round"/><rect x="22" y="26" width="16" height="6" rx="3"/>',
    # scooter
    '<circle cx="14" cy="46" r="8" fill="none" stroke="#334155" stroke-width="4"/>'
    '<circle cx="50" cy="46" r="8" fill="none" stroke="#334155" stroke-width="4"/>'
    '<path d="M14 46 h22 l6-24 h6" fill="none" stroke="#334155" stroke-width="4" '
    'stroke-linecap="round"/>',
    # tekne (yelkenli)
    '<path d="M10 44 h44 l-7 10 h-30z"/>'
    '<path d="M30 12 v30 h-16z"/><path d="M34 20 v22 h14z"/>',
    # denizalti
    '<ellipse cx="30" cy="36" rx="22" ry="12"/>'
    '<rect x="26" y="18" width="10" height="8" rx="2"/>'
    '<rect x="30" y="10" width="3" height="10"/>'
    '<circle cx="22" cy="36" r="4" fill="#f4f4f5"/><circle cx="36" cy="36" r="4" fill="#f4f4f5"/>'
    '<polygon points="52,30 60,36 52,42"/>',
    # balon
    '<path d="M32 8 q16 0 16 18 q0 12-16 20 q-16-8-16-20 q0-18 16-18z"/>'
    '<rect x="26" y="46" width="12" height="10" rx="2"/>',
    # kaykay
    '<rect x="8" y="34" width="48" height="6" rx="3"/>'
    '<circle cx="20" cy="46" r="5"/><circle cx="44" cy="46" r="5"/>',
    # ambulans
    '<rect x="6" y="22" width="34" height="22" rx="3"/>'
    '<path d="M40 28 h10 l8 8 v8 h-18z"/>'
    '<rect x="18" y="28" width="12" height="4" fill="#f4f4f5"/>'
    '<rect x="22" y="24" width="4" height="12" fill="#f4f4f5"/>'
    '<circle cx="16" cy="48" r="5"/><circle cx="48" cy="48" r="5"/>',
    # itfaiye
    '<rect x="6" y="24" width="26" height="20" rx="3"/>'
    '<rect x="32" y="18" width="26" height="26" rx="3"/>'
    '<rect x="36" y="22" width="18" height="4" fill="#f4f4f5"/>'
    '<circle cx="16" cy="48" r="5"/><circle cx="46" cy="48" r="5"/>',
    # vinç
    '<rect x="10" y="42" width="26" height="12" rx="3"/>'
    '<circle cx="18" cy="54" r="4"/><circle cx="30" cy="54" r="4"/>'
    '<path d="M24 42 v-28 h28" fill="none" stroke="#334155" stroke-width="4"/>'
    '<path d="M50 14 v14" fill="none" stroke="#334155" stroke-width="3"/>'
    '<rect x="45" y="28" width="10" height="8" rx="2"/>',
    # tramvay
    '<rect x="12" y="12" width="40" height="34" rx="6"/>'
    '<rect x="17" y="18" width="12" height="12" fill="#f4f4f5"/>'
    '<rect x="35" y="18" width="12" height="12" fill="#f4f4f5"/>'
    '<circle cx="22" cy="50" r="4"/><circle cx="42" cy="50" r="4"/>'
    '<path d="M32 12 v-6 h10" fill="none" stroke="#334155" stroke-width="3"/>',
]

# ── Gezegenler (6) — emoji DEGIL, cizim ────────────────────────────────────
PLANETS: list[str] = [
    # dunya
    '<circle cx="32" cy="32" r="20"/>'
    '<path d="M14 26 q10 6 20 0 t16 4 M18 42 q12-4 20 2" stroke="#f4f4f5" '
    'stroke-width="4" fill="none"/>',
    # halkali gezegen (saturn)
    '<circle cx="32" cy="32" r="14"/>'
    '<ellipse cx="32" cy="32" rx="26" ry="7" fill="none" stroke="#334155" '
    'stroke-width="3.5"/>',
    # dolunay (kraterli)
    '<circle cx="32" cy="32" r="20"/>'
    '<circle cx="25" cy="26" r="4" fill="#f4f4f5"/>'
    '<circle cx="38" cy="36" r="5" fill="#f4f4f5"/>'
    '<circle cx="27" cy="41" r="3" fill="#f4f4f5"/>',
    # hilal — iki daire, evenodd ile fark alinir.
    # (Tek path'te ters yonlu iki yay yazilirsa alanlar birbirini goturur ve
    #  ikon BOMBOS cikar; canvas olcumunde yakalandi.)
    '<path fill-rule="evenodd" d="M30 12 a20 20 0 1 0 0 40 a20 20 0 1 0 0-40z '
    'M40 14 a17 17 0 1 0 0 36 a17 17 0 1 0 0-36z"/>',
    # gunes
    '<circle cx="32" cy="32" r="12"/>'
    '<path d="M32 4 v8 M32 52 v8 M4 32 h8 M52 32 h8 M12 12 l6 6 M46 46 l6 6 '
    'M52 12 l-6 6 M18 46 l-6 6" stroke="#334155" stroke-width="4" '
    'stroke-linecap="round" fill="none"/>',
    # kizil gezegen (kraterli, farkli desen)
    '<circle cx="32" cy="32" r="19"/>'
    '<ellipse cx="24" cy="24" rx="6" ry="4" fill="#f4f4f5"/>'
    '<ellipse cx="41" cy="38" rx="7" ry="5" fill="#f4f4f5"/>',
]

# ── Meslekler (6) — emoji DEGIL, cizim ─────────────────────────────────────
JOBS: list[str] = [
    # doktor (onluk + stetoskop)
    '<circle cx="32" cy="16" r="9"/>'
    '<path d="M14 54 q0-20 18-20 t18 20z"/>'
    '<rect x="29" y="38" width="6" height="14" fill="#f4f4f5"/>'
    '<rect x="23" y="42" width="18" height="6" fill="#f4f4f5"/>',
    # ogretmen (kitap + kafa)
    '<circle cx="32" cy="16" r="9"/>'
    '<path d="M12 34 h20 v20 h-20z"/><path d="M32 34 h20 v20 h-20z"/>'
    '<rect x="30" y="34" width="4" height="20"/>',
    # insaat iscisi (bareli)
    '<circle cx="32" cy="24" r="10"/>'
    '<path d="M14 24 q0-16 18-16 t18 16z"/><rect x="10" y="24" width="44" height="5" rx="2"/>'
    '<path d="M16 56 q0-14 16-14 t16 14z"/>',
    # ressam (palet)
    '<path d="M32 10 q22 0 22 18 q0 8-9 8 h-6 q-5 0-5 5 q0 6-8 6 q-16 0-16-19 '
    'q0-18 22-18z"/>'
    '<circle cx="22" cy="24" r="4" fill="#f4f4f5"/>'
    '<circle cx="34" cy="20" r="4" fill="#f4f4f5"/>'
    '<circle cx="44" cy="28" r="4" fill="#f4f4f5"/>',
    # asci (kep)
    '<circle cx="32" cy="34" r="10"/>'
    '<path d="M16 30 q-8-14 6-16 q4-8 10-4 q6-4 10 4 q14 2 6 16z"/>'
    '<rect x="16" y="30" width="32" height="6" rx="2"/>'
    '<path d="M18 56 q0-14 14-14 t14 14z"/>',
    # polis (yildizli sapka)
    '<circle cx="32" cy="34" r="10"/>'
    '<path d="M16 28 q0-14 16-14 t16 14z"/><rect x="12" y="28" width="40" height="5" rx="2"/>'
    '<polygon points="32,16 34,21 39,21 35,24 37,29 32,26 27,29 29,24 25,21 30,21" '
    'fill="#f4f4f5"/>'
    '<path d="M18 56 q0-14 14-14 t14 14z"/>',
]

LETTERS = [chr(c) for c in range(ord("A"), ord("Z") + 1)]   # 26
DIGITS = [str(d) for d in range(0, 10)]                      # 10 — 0'dan 9'a


def build() -> list[dict]:
    rows: list[dict] = []

    def add(category: str, uri: str) -> None:
        rows.append({"category": category, "data_uri": uri})

    for body in SHAPES:
        add("Geometrik Şekiller", _uri(_svg(body)))
    for body in BOARDS:
        add("Satranç Tahtası", _uri(_plain_svg(body)))

    # Satranc Taslari: uygulamanin KENDI seti (Cburnett) — 6 beyaz + 6 siyah.
    pieces = json.loads(PIECES.read_text(encoding="utf-8"))
    for key in ("wK", "wQ", "wR", "wB", "wN", "wP",
                "bK", "bQ", "bR", "bB", "bN", "bP"):
        # Ic <svg> etiketi ATILIR: ic ice svg kendi koordinat sistemini
        # kurar ve transform ile olceklenince tas karttan tasar. Yalnizca
        # icerik alinip 45 -> 52 birim olceginde kartin ortasina konur.
        inner = _strip_svg_wrapper(pieces[key])
        wrapped = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
            f'{CARD}<g transform="translate(6 6) scale(1.1556)">'
            f"{inner}</g></svg>"
        )
        add("Satranç Taşları", _uri(wrapped))

    for body in ANIMALS:
        add("Hayvanlar", _uri(_svg(body)))
    for body in PLANTS:
        add("Bitkiler", _uri(_svg(body)))
    for body in VEHICLES:
        add("Taşıtlar", _uri(_svg(body)))
    for body in PLANETS:
        add("Gezegenler", _uri(_svg(body)))
    for body in JOBS:
        add("Meslekler", _uri(_svg(body)))
    for ch in LETTERS:
        add("Harfler", _uri(_glyph_svg(ch)))
    for ch in DIGITS:
        add("Rakamlar", _uri(_glyph_svg(ch)))

    return rows


if __name__ == "__main__":
    rows = build()
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(rows)} ikon yazildi -> {OUT}")
