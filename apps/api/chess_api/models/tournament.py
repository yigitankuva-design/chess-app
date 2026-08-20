import enum
from datetime import datetime
from sqlalchemy import String, Integer, Float, Enum, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class TournamentStatus(str, enum.Enum):
    upcoming = "upcoming"
    active = "active"
    finished = "finished"


class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    rounds_total: Mapped[int] = mapped_column(Integer)
    base_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    increment_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[TournamentStatus] = mapped_column(
        Enum(TournamentStatus), default=TournamentStatus.upcoming,
    )
    # Aktif oldugunda 1'den baslar; upcoming'de None.
    current_round: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class TournamentParticipant(Base):
    __tablename__ = "tournament_participants"

    id: Mapped[int] = mapped_column(primary_key=True)
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"), index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    # Galibiyet=1, beraberlik=0.5, kayip=0, bay gecme=1 (madde: Isvicre usulu).
    score: Mapped[float] = mapped_column(Float, default=0.0)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TournamentPairing(Base):
    __tablename__ = "tournament_pairings"

    id: Mapped[int] = mapped_column(primary_key=True)
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"), index=True)
    round_number: Mapped[int] = mapped_column(Integer)
    white_child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    # None = bay gecme (white_child_id otomatik 1 puan alir, mac oynanmaz).
    black_child_id: Mapped[int | None] = mapped_column(ForeignKey("child_profiles.id"), nullable=True, index=True)
    # Mac henuz baslamadiysa None — sporcu "Maca Basla" deyince doldurulur.
    # ON DELETE SET NULL: child_deletion.py bir maci hard-delete ederse bu
    # satir "oynanmamis" gibi kalir, patlamaz (KURAL #3).
    game_id: Mapped[int | None] = mapped_column(
        ForeignKey("games.id", ondelete="SET NULL"), nullable=True,
    )
    # '1-0' | '0-1' | '1/2-1/2' | 'bye' | None (henuz sonuclanmadi).
    result: Mapped[str | None] = mapped_column(String(10), nullable=True)
