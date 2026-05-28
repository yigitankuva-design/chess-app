import enum
from datetime import datetime
from sqlalchemy import (
    String, Integer, Boolean, Float, JSON, ForeignKey, DateTime, Index, Table,
    Column, Enum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from chess_api.database import Base


class SRSItemType(str, enum.Enum):
    lesson_step = "lesson_step"
    puzzle = "puzzle"


puzzle_themes_table = Table(
    "puzzle_themes_assoc", Base.metadata,
    Column("puzzle_id", ForeignKey("puzzles.id"), primary_key=True),
    Column("theme_id", ForeignKey("puzzle_themes.id"), primary_key=True),
)


class Puzzle(Base):
    __tablename__ = "puzzles"
    id: Mapped[int] = mapped_column(primary_key=True)
    lichess_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    fen: Mapped[str] = mapped_column(String(120))
    moves_json: Mapped[list] = mapped_column(JSON)
    rating: Mapped[int] = mapped_column(Integer, index=True)
    popularity: Mapped[int] = mapped_column(Integer, default=0)
    module_id: Mapped[int | None] = mapped_column(
        ForeignKey("modules.id"), nullable=True, index=True
    )

    themes: Mapped[list["PuzzleTheme"]] = relationship(
        secondary=puzzle_themes_table, backref="puzzles"
    )

    __table_args__ = (
        Index("ix_puzzles_module_rating", "module_id", "rating"),
    )


class PuzzleTheme(Base):
    __tablename__ = "puzzle_themes"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name_tr: Mapped[str] = mapped_column(String(80))
    description_tr: Mapped[str | None] = mapped_column(String(255), nullable=True)


class ChildPuzzleAttempt(Base):
    __tablename__ = "child_puzzle_attempts"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    puzzle_id: Mapped[int] = mapped_column(ForeignKey("puzzles.id"), index=True)
    success: Mapped[bool] = mapped_column(Boolean)
    time_seconds: Mapped[int] = mapped_column(Integer)
    attempted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SRSCard(Base):
    __tablename__ = "srs_cards"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    item_type: Mapped[SRSItemType] = mapped_column(Enum(SRSItemType))
    item_id: Mapped[int] = mapped_column(Integer)
    due_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    interval_days: Mapped[float] = mapped_column(Float, default=0.0)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    reps_count: Mapped[int] = mapped_column(Integer, default=0)
    last_result: Mapped[str | None] = mapped_column(String(10), nullable=True)
