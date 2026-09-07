from datetime import datetime, date
from sqlalchemy import String, ForeignKey, DateTime, Date
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class Class(Base):
    __tablename__ = "classes"
    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    join_code: Mapped[str] = mapped_column(String(8), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ClassAssignment(Base):
    """Bir ödev — ya bir SINIFA (class_id) ya da TEK bir sporcuya
    (target_child_id) atanır; ikisinden TAM OLARAK BİRİ dolu olmalı (bu
    kural router seviyesinde doğrulanır). `teacher_user_id` ödevi oluşturan
    öğretmen — bireysel atamada sınıf olmadığı için sahiplik BURADAN okunur.
    `source_custom_tab_section_id` — madde 2026-09-05: bu ödevin Antrenör'de
    HANGİ Alt Konu anlatılırken verildiğini kaydeder (izlenebilirlik)."""

    __tablename__ = "class_assignments"
    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id"), nullable=True, index=True)
    target_child_id: Mapped[int | None] = mapped_column(
        ForeignKey("child_profiles.id"), nullable=True, index=True,
    )
    target_module_id: Mapped[int | None] = mapped_column(ForeignKey("modules.id"), nullable=True)
    target_lesson_id: Mapped[int | None] = mapped_column(ForeignKey("lessons.id"), nullable=True)
    # Madde 2026-09-07 (GRUP D): DERS İÇİNDEKİ belirli bir Alt Konu (lesson_step)
    # hedeflenirse — bu doluysa, o Alt Konu'nun "Ödevini Yap" sekmesi sporcu
    # tarafında (normal zincir kilidini EZEREK) aktifleşir, bkz.
    # GET /assignments/my-active-step-ids ve LessonProgressCard. Eski
    # target_module_id/target_lesson_id davranışı BOZULMADI (KURAL #3) —
    # bu üçüncü, daha GRANÜLER bir hedefleme seçeneği.
    target_lesson_step_id: Mapped[int | None] = mapped_column(ForeignKey("lesson_steps.id"), nullable=True)
    source_custom_tab_section_id: Mapped[int | None] = mapped_column(
        ForeignKey("custom_tab_sections.id"), nullable=True,
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
