from datetime import datetime
from sqlalchemy import Integer, String, DateTime, ForeignKey, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class ChildPracticeResult(Base):
    """Bir çocuğun bir ALT KONU (lesson_step) × pratik modundaki en iyi sonucu.

    child_lesson_progress'ten ayrı bir tablodur: o tablo ders bazlı adım ilerlemesi
    tutar, burada ihtiyaç duyulan ise alt konu × mod bazlı en yüksek skordur.
    Ayrı tablo, mevcut satırları ve mevcut kodu hiç etkilemez (KURAL #3).
    """

    __tablename__ = "child_practice_results"
    __table_args__ = (
        UniqueConstraint("child_id", "lesson_step_id", "mode", name="uq_practice_child_step_mode"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    lesson_step_id: Mapped[int] = mapped_column(ForeignKey("lesson_steps.id"), index=True)
    mode: Mapped[str] = mapped_column(String(16))  # suresiz | sureli | test
    best_score: Mapped[int] = mapped_column(Integer, default=0)  # 0..100
    best_correct: Mapped[int] = mapped_column(Integer, default=0)
    best_total: Mapped[int] = mapped_column(Integer, default=0)
    attempts_count: Mapped[int] = mapped_column(Integer, default=0)
    last_played_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Madde 2026-09-05: Sporcu Profili'ndeki "ÖDEVLERİM" panelinin soru
    # bazlı yeşil/kırmızı kareleri için — EN İYİ denemenin soru sırasına
    # göre doğru/yanlış listesi (best_correct/best_total ile AYNI denemeye
    # ait). Hiç deneme yoksa veya en iyi deneme güncellenmediyse None.
    per_question_correct: Mapped[list | None] = mapped_column(JSON, nullable=True)


class ChildPracticeAttempt(Base):
    """Madde 2026-09-06 (Görsel 6/7): Bir çocuğun bir ALT KONU × pratik
    modundaki HER DENEMESİ (best değil, TÜM geçmiş) — ayrı bir tablo,
    ChildPracticeResult'ı (en iyi deneme) hiç etkilemez (KURAL #3).

    - Süreli Pratik Yap (Görsel 6): günlük/haftalık/aylık/yıllık istatistik
      bu tablonun `created_at`'ine göre toplanır.
    - Kendini Test Et (Görsel 7): her satır bir "Sınav-N" sekmesi —
      `attempt_no` sırasına göre listelenir, her birinin kendi
      `per_question_correct`'i vardır.
    """

    __tablename__ = "child_practice_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    lesson_step_id: Mapped[int] = mapped_column(ForeignKey("lesson_steps.id"), index=True)
    mode: Mapped[str] = mapped_column(String(16))  # suresiz | sureli | test
    attempt_no: Mapped[int] = mapped_column(Integer)  # bu (child, step, mode) için 1'den başlar
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    total_count: Mapped[int] = mapped_column(Integer, default=0)
    per_question_correct: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
