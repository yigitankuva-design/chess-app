import enum
from datetime import datetime
from sqlalchemy import String, Integer, Enum, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class GameType(str, enum.Enum):
    bot = "bot"
    human = "human"


class GameStatus(str, enum.Enum):
    active = "active"
    finished = "finished"
    aborted = "aborted"


class GameResult(str, enum.Enum):
    white_wins = "1-0"
    black_wins = "0-1"
    draw = "1/2-1/2"


class Game(Base):
    __tablename__ = "games"
    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[GameType] = mapped_column(Enum(GameType))
    status: Mapped[GameStatus] = mapped_column(Enum(GameStatus), default=GameStatus.active)
    result: Mapped[GameResult | None] = mapped_column(Enum(GameResult), nullable=True)
    white_child_id: Mapped[int | None] = mapped_column(ForeignKey("child_profiles.id"), nullable=True, index=True)
    black_child_id: Mapped[int | None] = mapped_column(ForeignKey("child_profiles.id"), nullable=True, index=True)
    black_bot_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    pgn: Mapped[str | None] = mapped_column(Text, nullable=True)


class GameMove(Base):
    __tablename__ = "game_moves"
    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True)
    ply: Mapped[int] = mapped_column(Integer)
    san: Mapped[str] = mapped_column(String(10))
    fen_after: Mapped[str] = mapped_column(String(120))
    time_left_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    by_child_id: Mapped[int | None] = mapped_column(ForeignKey("child_profiles.id"), nullable=True)
