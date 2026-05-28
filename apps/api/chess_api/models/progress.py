import enum
from datetime import datetime
from sqlalchemy import Integer, DateTime, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class LessonStatus(str, enum.Enum):
    locked = "locked"
    in_progress = "in_progress"
    completed = "completed"


class ChildLessonProgress(Base):
    __tablename__ = "child_lesson_progress"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"), index=True)
    status: Mapped[LessonStatus] = mapped_column(Enum(LessonStatus), default=LessonStatus.in_progress)
    current_step_index: Mapped[int] = mapped_column(Integer, default=0)
    total_time_seconds: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ChildLessonStepResult(Base):
    __tablename__ = "child_lesson_step_results"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    lesson_step_id: Mapped[int] = mapped_column(ForeignKey("lesson_steps.id"), index=True)
    attempts_count: Mapped[int] = mapped_column(Integer, default=1)
    success_at_attempt: Mapped[int | None] = mapped_column(Integer, nullable=True)
    time_seconds: Mapped[int] = mapped_column(Integer)
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
