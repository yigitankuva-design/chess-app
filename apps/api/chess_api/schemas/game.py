from typing import Literal
from pydantic import BaseModel
from chess_api.models.game import GameStatus, GameResult


class StartBotGameRequest(BaseModel):
    skill_level: int  # 0-20
    # Sporcunun ekranda oynadigi renk. Eski istemciler bu alani hic
    # gondermez -> varsayilan 'w' bugunku davranisla AYNI.
    student_color: Literal['w', 'b'] = 'w'
    # Acilis pratigi icin baslangic pozisyonu. Verilmezse standart baslangic.
    start_fen: str | None = None
    # Mac suresi (saniye). None/0 = suresiz.
    tc_base_seconds: int | None = None
    tc_increment_seconds: int = 0


class StartBotGameResponse(BaseModel):
    game_id: int
    fen: str
    your_color: str


class MakeMoveRequest(BaseModel):
    move_uci: str


class MoveResponse(BaseModel):
    accepted: bool
    fen_after: str | None = None
    is_checkmate: bool = False
    is_stalemate: bool = False
    game_status: GameStatus
    result: GameResult | None = None
