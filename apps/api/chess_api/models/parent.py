from datetime import datetime, date
from sqlalchemy import String, Integer, JSON, ForeignKey, DateTime, Date
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class ParentTimeLimit(Base):
    __tablename__ = "parent_time_limits"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), unique=True, index=True)
    daily_minutes_limit: Mapped[int] = mapped_column(Integer, default=60)
    reset_hour: Mapped[int] = mapped_column(Integer, default=4)  # 04:00 local reset


class ChildActivityLog(Base):
    """Per-day, per-child totals for limit enforcement + weekly summary."""
    __tablename__ = "child_activity_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    total_seconds: Mapped[int] = mapped_column(Integer, default=0)
    lessons_completed: Mapped[int] = mapped_column(Integer, default=0)
    puzzles_solved: Mapped[int] = mapped_column(Integer, default=0)
    games_played: Mapped[int] = mapped_column(Integer, default=0)


class ParentSurvey(Base):
    __tablename__ = "parent_surveys"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    questions_json: Mapped[list] = mapped_column(JSON)
    created_by_teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    # NOTE: target_class_id is a plain nullable int for now; the `classes` table
    # arrives in Plan 8, which will add the FK constraint via a migration.
    target_class_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ParentSurveyResponse(Base):
    __tablename__ = "parent_survey_responses"
    id: Mapped[int] = mapped_column(primary_key=True)
    survey_id: Mapped[int] = mapped_column(ForeignKey("parent_surveys.id"), index=True)
    parent_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    child_id: Mapped[int | None] = mapped_column(ForeignKey("child_profiles.id"), nullable=True)
    answers_json: Mapped[dict] = mapped_column(JSON)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
