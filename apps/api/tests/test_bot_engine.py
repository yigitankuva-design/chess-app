from chess_api.services.bot_engine import depth_for_skill


def test_tam_tablo_degerleri():
    """apps/web/lib/play/levels.ts'teki 8 duzeyle AYNI olmali."""
    assert depth_for_skill(0) == 1
    assert depth_for_skill(3) == 3
    assert depth_for_skill(6) == 5
    assert depth_for_skill(9) == 7
    assert depth_for_skill(12) == 8
    assert depth_for_skill(15) == 9
    assert depth_for_skill(18) == 11
    assert depth_for_skill(20) == 12


def test_ara_deger_en_yakin_ALT_basamaga_yuvarlanir():
    """Sessizce cok guclu bir bot uretmekten daha guvenli (bkz. tasarim
    belgesi, sorun B)."""
    assert depth_for_skill(7) == 5    # 6-9 arasi -> 6'nin derinligi
    assert depth_for_skill(1) == 1    # 0-3 arasi -> 0'in derinligi
    assert depth_for_skill(19) == 11  # 18-20 arasi -> 18'in derinligi


def test_uc_degerler():
    assert depth_for_skill(0) == 1
    assert depth_for_skill(20) == 12
