import chess


def validate_move(fen: str, move_uci: str) -> dict | None:
    """Validate a UCI move against a FEN. Returns new state dict, or None if illegal."""
    try:
        board = chess.Board(fen)
        move = chess.Move.from_uci(move_uci)
        if move not in board.legal_moves:
            return None
        san = board.san(move)
        board.push(move)
        return {
            "fen_after": board.fen(),
            "san": san,
            "is_check": board.is_check(),
            "is_checkmate": board.is_checkmate(),
            "is_stalemate": board.is_stalemate(),
            "is_game_over": board.is_game_over(),
        }
    except Exception:
        return None
