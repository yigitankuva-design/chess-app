from datetime import datetime
from sqlalchemy import Integer, String, DateTime, ForeignKey, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class ChildOdevProgress(Base):
    """Bir çocuğun bir ALT KONU (lesson_step) "Ödevini Yap" (suresiz mod)
    İLK çözümündeki BİRİKİMLİ ilerlemesi.

    Madde 2026-09-11 (Ödev Sistemi, Faz 1): "Ödevini Yap" artık başarı
    EŞİĞİYLE değil, "havuzdaki sabit N sorunun HEPSİ en az bir kez
    cevaplandı mı" ile tamamlanır. Sporcu birikimli ilerler (bugün 3,
    yarın 2), kaldığı yerden devam eder. `answered_map` = {havuz_index
    (str): doğru_mu (bool)} — index admin'in soru sırasıdır. N soru
    (question_counts.board_exercises, yoksa havuzun tamamı) bittiğinde
    `completed_at` set edilir; sonraki TEKRAR çözümler bu kaydı ETKİLEMEZ
    (sadece ilk çözümün istatistiği profile yansır — Zafer'in kararı).

    ChildPracticeResult (sureli/test'in "en iyi deneme" mantığı) HİÇ
    DEĞİŞMEDEN kalır — bu AYRI bir tablo (KURAL #3).
    """

    __tablename__ = "child_odev_progress"
    __table_args__ = (
        UniqueConstraint("child_id", "lesson_step_id", name="uq_odev_child_step"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    lesson_step_id: Mapped[int] = mapped_column(ForeignKey("lesson_steps.id"), index=True)
    # {"0": true, "1": false, ...} — havuz index'i (admin sırası) -> doğru/yanlış
    answered_map: Mapped[dict] = mapped_column(JSON, default=dict)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow,
    )


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
