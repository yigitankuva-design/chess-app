from chess_api.services.clock import ClockState, elapsed_ms, apply_move, is_flagged

T0 = 1_000_000.0  # sabit bir an (epoch saniye)


def _state(white=300_000, black=300_000, last=T0, inc=0):
    return ClockState(white_ms=white, black_ms=black, last_at=last, increment_ms=inc)


def test_elapsed_ms_gecen_sureyi_hesaplar():
    assert elapsed_ms(T0, T0 + 2.5) == 2500


def test_elapsed_ms_negatif_donmez():
    """Sunucu saati geri giderse 0 kabul edilir — negatif sure olmaz."""
    assert elapsed_ms(T0, T0 - 5) == 0


def test_apply_move_hamleyi_yapanin_saatinden_duser():
    s = apply_move(_state(), white_to_move=True, now=T0 + 2)
    assert s.white_ms == 298_000
    assert s.black_ms == 300_000      # rakibin saatine DOKUNULMAZ
    assert s.last_at == T0 + 2


def test_apply_move_siyah_oynayinca_siyahtan_duser():
    s = apply_move(_state(), white_to_move=False, now=T0 + 3)
    assert s.black_ms == 297_000
    assert s.white_ms == 300_000


def test_artirim_hamleden_SONRA_eklenir():
    """5+3: hamle 2 sn surdu -> 300000 - 2000 + 3000 = 301000."""
    s = apply_move(_state(inc=3000), white_to_move=True, now=T0 + 2)
    assert s.white_ms == 301_000


def test_saat_sifirin_altina_dusmez():
    s = apply_move(_state(white=1000), white_to_move=True, now=T0 + 10)
    assert s.white_ms == 0


def test_suresi_biten_oyuncuya_artirim_verilmez():
    """Sure bittiyse hamle gecerli sayilmaz; artirim eklenerek diriltilmez."""
    s = apply_move(_state(white=1000, inc=3000), white_to_move=True, now=T0 + 10)
    assert s.white_ms == 0


def test_is_flagged_hamle_beklerken_de_calisir():
    st = _state(white=5_000)
    assert is_flagged(st, white_to_move=True, now=T0 + 4) is False
    assert is_flagged(st, white_to_move=True, now=T0 + 6) is True


def test_is_flagged_sirasi_olmayani_bayraklamaz():
    st = _state(white=1_000, black=300_000)
    # Sira SIYAHTA; beyazin suresi az olsa da beyaz bayraklanmaz.
    assert is_flagged(st, white_to_move=False, now=T0 + 60) is False
