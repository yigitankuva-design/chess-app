"""Terfi UCI'si — sunucu tarafi (madde 2)."""
from chess_api.services.game_validation import validate_move
FEN = "7k/4P3/8/8/8/8/8/K7 w - - 0 1"
def test_terfi_uci_kabul_edilir():
    r = validate_move(FEN, "e7e8n")
    assert r is not None
    assert r["san"] == "e8=N"

def test_terfi_harfsiz_uci_reddedilir():
    """python-chess terfi harfi olmayan piyon-son-sira hamlesini YASADISI sayar;
    bu yuzden istemci terfi harfini gondermek ZORUNDA."""
    assert validate_move(FEN, "e7e8") is None
