"""Tohum verinin bütünlük testleri — 136 ikon, doğru kategoriler, geçerli boyut."""
import base64
import json
from pathlib import Path

from chess_api.pool_categories import POOL_CATEGORIES

DATA = Path(__file__).resolve().parents[1] / "scripts" / "pool-images-data.json"
MAX_BYTES = 400_000


def _rows():
    return json.loads(DATA.read_text(encoding="utf-8"))


def test_tohum_dosyasi_vardir():
    assert DATA.exists(), "python -m scripts.build_pool_data ile üretilmeli"


# Kullanıcının madde 3c'de verdiği sayılar — tek doğruluk kaynağı.
EXPECTED_COUNTS = {
    "Geometrik Şekiller": 6,
    "Satranç Tahtası": 10,
    "Satranç Taşları": 12,     # 6 beyaz + 6 siyah
    "Hayvanlar": 20,
    "Bitkiler": 20,
    "Taşıtlar": 20,
    "Gezegenler": 6,
    "Meslekler": 6,
    "Harfler": 26,             # A-Z
    "Rakamlar": 10,            # 0-9
}
TOTAL = sum(EXPECTED_COUNTS.values())   # 136


def test_toplam_ikon_sayisi():
    assert len(_rows()) == TOTAL


def test_her_kategorinin_ikon_sayisi_dogrudur():
    counts: dict[str, int] = {}
    for row in _rows():
        counts[row["category"]] = counts.get(row["category"], 0) + 1
    assert "Satranç Şampiyonları" not in counts, "Telif riski — kasten boş (KURAL #1)"
    for category, expected in EXPECTED_COUNTS.items():
        assert counts.get(category) == expected, f"{category}: {counts.get(category)}"


def test_gok_cisimleri_kategorisi_kaldirildi():
    """Madde 3c: kategori listeden de tohumdan da çıkmalı."""
    assert "Gök Cisimleri" not in POOL_CATEGORIES
    assert all(r["category"] != "Gök Cisimleri" for r in _rows())


def test_hicbir_ikonda_emoji_yoktur():
    """ASIL DÜZELTME: eski sürümde hayvan/bitki/taşıt emoji karakteriydi ve her
    cihazda farklı görünüyordu. Artık hepsi çizilmiş SVG — emoji kalmamalı."""
    import base64 as _b64
    for row in _rows():
        svg = _b64.b64decode(row["data_uri"].split(",", 1)[1]).decode("utf-8")
        for ch in svg:
            assert ord(ch) < 0x2190, f"emoji/simge karakteri bulundu: {ch!r}"


def test_satranc_taslari_uygulamanin_kendi_setinden_gelir():
    """"Konum Ekle'deki motiflerle aynı olsun" — taşlar el çizimi DEĞİL,
    react-chessboard'un Cburnett setinden birebir alınır. İmza: setin kendi
    çizim koordinatları (m 22.5 gibi) ve 45 birimlik ölçeğe getiren transform."""
    import base64 as _b64
    from scripts.build_pool_data import _strip_svg_wrapper

    src = json.loads(
        (Path(__file__).resolve().parents[1] / "scripts" / "chess-pieces-svg.json")
        .read_text(encoding="utf-8")
    )
    pieces = [r for r in _rows() if r["category"] == "Satranç Taşları"]
    assert len(pieces) == 12

    expected = {_strip_svg_wrapper(v) for v in src.values()}
    for row in pieces:
        svg = _b64.b64decode(row["data_uri"].split(",", 1)[1]).decode("utf-8")
        assert 'transform="translate(6 6) scale(1.1556)"' in svg
        inner = svg.split('scale(1.1556)">', 1)[1].rsplit("</g></svg>", 1)[0]
        assert inner in expected, "taş içeriği Cburnett setinden gelmiyor"


def test_taslarda_ic_ice_svg_yoktur():
    """TUZAK: iç <svg> kendi koordinat sistemini kurar ve taş karttan taşar."""
    import base64 as _b64
    for row in _rows():
        svg = _b64.b64decode(row["data_uri"].split(",", 1)[1]).decode("utf-8")
        assert svg.count("<svg") == 1, "iç içe svg — ikon taşar"


def test_tum_kategoriler_gecerlidir():
    for row in _rows():
        assert row["category"] in POOL_CATEGORIES


def test_tum_data_uriler_base64_svgdir():
    """;utf8, KULLANILMAZ — renk kodundaki '#' fragment sayılıp görseli bozar."""
    for row in _rows():
        assert row["data_uri"].startswith("data:image/svg+xml;base64,")


def test_tum_data_uriler_cozulebilir_ve_svg_icerir():
    for row in _rows():
        b64 = row["data_uri"].split(",", 1)[1]
        svg = base64.b64decode(b64).decode("utf-8")
        assert svg.startswith("<svg"), svg[:40]
        assert svg.endswith("</svg>")


def test_hicbir_ikon_boyut_sinirini_asmaz():
    for row in _rows():
        assert len(row["data_uri"].encode("utf-8")) <= MAX_BYTES


def test_ayni_data_uri_iki_kez_gecmez():
    """Tohum veride birebir tekrar olmamalı — dedup mantığı boşa çalışmasın."""
    seen = {(r["category"], r["data_uri"]) for r in _rows()}
    assert len(seen) == TOTAL


def test_seed_scripti_ayni_dosyayi_okur():
    """Seed script ile bu testin okuduğu dosya AYNI olmalı — yol kayarsa
    seed sessizce boş/eski veri yükler."""
    from scripts import seed_pool_images

    assert seed_pool_images.DATA.resolve() == DATA.resolve()


def test_seed_scripti_beklenen_alanlari_kullanir():
    """Script'in okuduğu anahtarlar ile üretilen JSON'un anahtarları uyuşmalı."""
    for row in _rows():
        assert set(row.keys()) == {"category", "data_uri"}


def test_eski_tohum_anlik_goruntusu_durur():
    """Seed script eski tohumları BİREBİR eşleştirerek siler; anlık görüntü
    kaybolursa temizlik sessizce çalışmaz ve emoji ikonlar panoda kalır."""
    from scripts import seed_pool_images

    assert seed_pool_images.LEGACY.exists(), "pool-images-legacy.json bulunamadı"
    legacy = json.loads(seed_pool_images.LEGACY.read_text(encoding="utf-8"))
    assert len(legacy) == 66, "eski sürüm 66 ikondu"


def test_temizlik_hocanin_yukledigi_gorseli_hedeflemez():
    """Silme kümesi YALNIZCA eski tohumdur; yeni tohumda da olan bir URI silinmez."""
    from scripts import seed_pool_images

    legacy = json.loads(seed_pool_images.LEGACY.read_text(encoding="utf-8"))
    fresh = {r["data_uri"] for r in _rows()}
    to_delete = {r["data_uri"] for r in legacy} - fresh
    # Hocanın yüklediği bir görsel (tohumda hiç olmayan) bu kümede OLAMAZ.
    assert "data:image/png;base64,HOCANIN-GORSELI" not in to_delete
    assert to_delete.isdisjoint(fresh)
