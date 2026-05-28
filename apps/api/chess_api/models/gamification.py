from datetime import datetime
from sqlalchemy import String, Integer, JSON, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class Badge(Base):
    __tablename__ = "badges"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name_tr: Mapped[str] = mapped_column(String(80))
    description_tr: Mapped[str] = mapped_column(String(255))
    icon: Mapped[str] = mapped_column(String(40))
    criteria_json: Mapped[dict] = mapped_column(JSON)


class ChildBadge(Base):
    __tablename__ = "child_badges"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    badge_id: Mapped[int] = mapped_column(ForeignKey("badges.id"), index=True)
    earned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Rank(Base):
    __tablename__ = "ranks"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_index: Mapped[int] = mapped_column(Integer, unique=True)
    name_tr: Mapped[str] = mapped_column(String(40))
    xp_required: Mapped[int] = mapped_column(Integer)
    icon: Mapped[str] = mapped_column(String(40))


class ChildRank(Base):
    __tablename__ = "child_ranks"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), unique=True, index=True)
    current_rank_id: Mapped[int] = mapped_column(ForeignKey("ranks.id"))
    xp_total: Mapped[int] = mapped_column(Integer, default=0)
