from pydantic import BaseModel
from chess_api.models.game import GameStatus, GameResult


class StartBotGameRequest(BaseModel):
    skill_level: int  # 0-20


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
