import enum
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, Enum, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class GameType(str, enum.Enum):
    bot = "bot"
    human = "human"


class GameStatus(str, enum.Enum):
    active = "active"
    finished = "finished"
    aborted = "aborted"


class GameResult(str, enum.Enum):
    white_wins = "1-0"
    black_wins = "0-1"
    draw = "1/2-1/2"


class Game(Base):
    __tablename__ = "games"
    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[GameType] = mapped_column(Enum(GameType))
    status: Mapped[GameStatus] = mapped_column(Enum(GameStatus), default=GameStatus.active)
    result: Mapped[GameResult | None] = mapped_column(
        Enum(GameResult, name="gameresult", values_callable=lambda e: [m.value for m in e]),
        nullable=True,
    )
    white_child_id: Mapped[int | None] = mapped_column(ForeignKey("child_profiles.id"), nullable=True, index=True)
    black_child_id: Mapped[int | None] = mapped_column(ForeignKey("child_profiles.id"), nullable=True, index=True)
    black_bot_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Sporcunun EKRANDA gordugu renk ('w'/'b'). white_child_id/black_child_id
    # semantigine (rozet sistemi bunlara dayanir, bkz. badge_engine.py) HIC
    # dokunulmaz — bu SADECE goruntuleme/motor-yon bilgisidir. NULL = eski
    # kayit, 'w' varsayilir (bugunku davranisla ayni).
    student_color: Mapped[str | None] = mapped_column(String(1), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    pgn: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Beraberlik teklifi sayaclari (madde d) — oyuncu basina en fazla 3 teklif.
    white_draw_offers: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    black_draw_offers: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    # Acilis pratigi icin baslangic pozisyonu. None => standart baslangic (geriye uyumlu).
    start_fen: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Madde 6 (2026-08-20): "Oyun Modu" — Puanli macta Performans Puani
    # degisir (bkz. services/rating.py), Puansizda hic dokunulmaz. Varsayilan
    # False: eski maclar ve bot maclari (rated hic ayarlanmaz) etkilenmez.
    rated: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    # ── Mac saati (insan-insan maclar). HEPSI NULL OLABILIR: eski maclarda
    # bos kalir ve saat mantigi HIC calismaz (geriye donuk uyum, KURAL #3).
    # Milisaniye kullanilir; saniyeyle tutulursa her hamlede yuvarlama kaybi olur.
    base_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    increment_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    white_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    black_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_clock_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Madde 2026-09-XX: Berserk yapan taraf artırımı da KAYBEDER (sadece
    # süre yarılanmıyor) — services/clock.py per-taraf artırım hesabı için
    # bu bayrağa bakar (bkz. routers/live_game.py::_clock_state). Puanlama
    # bonusu HÂLÂ tournament_pairings.white_berserked/black_berserked'ten
    # okunur (bilinçli küçük tekrar, bkz. migration BerserkIncrementGameFlags).
    white_berserked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    black_berserked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")


class GameMove(Base):
    __tablename__ = "game_moves"
    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True)
    ply: Mapped[int] = mapped_column(Integer)
    san: Mapped[str] = mapped_column(String(10))
    fen_after: Mapped[str] = mapped_column(String(120))
    time_left_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    by_child_id: Mapped[int | None] = mapped_column(ForeignKey("child_profiles.id"), nullable=True)
