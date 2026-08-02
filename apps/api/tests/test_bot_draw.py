"""apps/web/lib/play/botDraw.ts ile AYNI senaryolar — Python tarafi."""
from chess_api.services.bot_draw import material_diff, bot_accepts_draw

BASLANGIC = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
# Beyazin fazla bir veziri var (siyahin veziri yok).
BEYAZ_ONDE = "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
# Siyahin fazla bir kalesi var (beyazin a1 kalesi yok).
SIYAH_ONDE = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBNR w KQkq - 0 1"


def test_baslangic_konumunda_fark_yoktur():
    assert material_diff(BASLANGIC) == 0


def test_eksik_siyah_vezir_beyaz_lehine_9_yapar():
    assert material_diff(BEYAZ_ONDE) == 9


def test_eksik_beyaz_kale_siyah_lehine_5_yapar():
    assert material_diff(SIYAH_ONDE) == -5


def test_yalnizca_tas_dizilimi_okunur():
    # "b KQkq" icindeki b ve K harfleri tas sanilirsa sonuc bozulur.
    assert material_diff(BASLANGIC.replace(" w ", " b ")) == 0


def test_esit_konumda_kabul_eder():
    assert bot_accepts_draw(BASLANGIC, "b") is True
    assert bot_accepts_draw(BASLANGIC, "w") is True


def test_bot_acik_ara_ondeyse_reddeder():
    assert bot_accepts_draw(BEYAZ_ONDE, "w") is False


def test_bot_geride_ise_kabul_eder():
    assert bot_accepts_draw(BEYAZ_ONDE, "b") is True


def test_bir_piyonluk_ustunluk_reddetmeye_yetmez():
    bir_piyon_fazla = "rnbqkbnr/ppppppp1/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    assert material_diff(bir_piyon_fazla) == 1
    assert bot_accepts_draw(bir_piyon_fazla, "w") is True
