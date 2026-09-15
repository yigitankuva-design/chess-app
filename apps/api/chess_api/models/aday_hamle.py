"""Aday Hamle Pratiği — sporcu tarafı oturum kaydı (madde 2026-09-16).

Ödev sisteminin `ChildOdevProgress`'i buraya UYMUYOR: o `lesson_steps.id`'ye
bağlı, tek satır, sadece doğru/yanlış (bool) tutuyor. Burada süreli bir
OTURUM var (child, section_id=custom_tab_sections.id — Homework'ün
`source_custom_tab_section_id`'siyle AYNI FK deseni) ve "Kontrol Et" ekranı
için sporcunun VERDİĞİ HAMLELERİN KENDİSİ de saklanmak zorunda (Ödev/Attempt
modellerinin hiçbiri bunu tutmuyor).

`pool_snapshot`, oturum başında dondurulur — sonradan admin havuzu
değiştirse/silse bile bu oturum tutarlı kalır. Şekli:
[{"id": str, "fen": str, "candidate_moves": [{"move_uci","move_san","score_cp","mate"}, ...]}]

`answers`, sporcu her pozisyonu cevapladıkça birikir. Şekli:
[{"position_id": str, "student_moves": [uci,uci,uci], "results": [bool,bool,bool]}]
"""
from datetime import datetime
from sqlalchemy import Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class ChildAdayHamleSession(Base):
    __tablename__ = "child_aday_hamle_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("custom_tab_sections.id"), index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    pool_snapshot: Mapped[list] = mapped_column(JSON)
    current_index: Mapped[int] = mapped_column(Integer, default=0)
    answers: Mapped[list] = mapped_column(JSON, default=list)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
