import enum
from sqlalchemy import String, Integer, Text, JSON, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class LessonStepType(str, enum.Enum):
    explanation = "explanation"
    inline_exercise = "inline_exercise"
    quiz = "quiz"


class Module(Base):
    __tablename__ = "modules"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_index: Mapped[int] = mapped_column(Integer, unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    icon: Mapped[str] = mapped_column(String(40), default="default")


class Lesson(Base):
    __tablename__ = "lessons"
    id: Mapped[int] = mapped_column(primary_key=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("modules.id"), index=True)
    order_index: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(160))
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=10)


class LessonStep(Base):
    __tablename__ = "lesson_steps"
    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"), index=True)
    order_index: Mapped[int] = mapped_column(Integer)
    type: Mapped[LessonStepType] = mapped_column(Enum(LessonStepType))
    content_json: Mapped[dict] = mapped_column(JSON)
    correct_answer_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
