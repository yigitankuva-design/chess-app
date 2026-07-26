"""Tohum verinin bütünlük testleri — 66 ikon, doğru kategoriler, geçerli boyut."""
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


def test_altmis_alti_ikon_vardir():
    assert len(_rows()) == 66


def test_her_kategoride_alti_ikon_vardir_sampiyonlar_haric():
    counts: dict[str, int] = {}
    for row in _rows():
        counts[row["category"]] = counts.get(row["category"], 0) + 1
    assert "Satranç Şampiyonları" not in counts, "Telif riski — kasten boş (KURAL #1)"
    for category in POOL_CATEGORIES:
        if category == "Satranç Şampiyonları":
            continue
        assert counts.get(category) == 6, f"{category}: {counts.get(category)}"


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
    assert len(seen) == 66


def test_seed_scripti_ayni_dosyayi_okur():
    """Seed script ile bu testin okuduğu dosya AYNI olmalı — yol kayarsa
    seed sessizce boş/eski veri yükler."""
    from scripts import seed_pool_images

    assert seed_pool_images.DATA.resolve() == DATA.resolve()


def test_seed_scripti_beklenen_alanlari_kullanir():
    """Script'in okuduğu anahtarlar ile üretilen JSON'un anahtarları uyuşmalı."""
    for row in _rows():
        assert set(row.keys()) == {"category", "data_uri"}
