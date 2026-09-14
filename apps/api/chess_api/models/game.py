import enum
from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, Enum, ForeignKey, DateTime, Text, JSON
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
    # Madde 2026-09-06 (8): "Maçlarımın Analizi" kartında puan farkını
    # ("±N") gösterebilmek için — apply_rating_update() içinde puan
    # GÜNCELLENMEDEN hemen önce/sonra yakalanır. Puansız/bot maçlarda (o
    # fonksiyon erken döner) HEPSİ NULL kalır — frontend bunu "puan yok"
    # sinyali olarak kullanır.
    white_rating_before: Mapped[int | None] = mapped_column(Integer, nullable=True)
    white_rating_after: Mapped[int | None] = mapped_column(Integer, nullable=True)
    black_rating_before: Mapped[int | None] = mapped_column(Integer, nullable=True)
    black_rating_after: Mapped[int | None] = mapped_column(Integer, nullable=True)


class GameMove(Base):
    __tablename__ = "game_moves"
    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True)
    ply: Mapped[int] = mapped_column(Integer)
    san: Mapped[str] = mapped_column(String(10))
    fen_after: Mapped[str] = mapped_column(String(120))
    time_left_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    by_child_id: Mapped[int | None] = mapped_column(ForeignKey("child_profiles.id"), nullable=True)


class GameAnalysis(Base):
    """Madde 2026-09-14 (sunucu analiz motoru): bir maçın "Analiz Et"
    özetinin SAKLANMIŞ hâli — motor artık BACKEND'de (native Stockfish,
    bkz. services/game_analysis_engine.py) çalışıyor, bu tablo sonucu
    tutar. Amaç: aynı maç ikinci kez açıldığında (Maçlarımın Analizi)
    motor baştan çalışmasın; "Hatalarını Gözden Geçir" de
    `mistake_moves_json`'ı doğrudan kullanabilsin. Hesaplama
    `apps/web/lib/chess/gameSummary.ts::computeGameSummary`'nin BİREBİR
    Python karşılığıdır (bkz. o dosyadaki GameSummary tipi)."""
    __tablename__ = "game_analyses"
    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), unique=True, index=True)
    inaccuracies: Mapped[int] = mapped_column(Integer)
    mistakes: Mapped[int] = mapped_column(Integer)
    blunders: Mapped[int] = mapped_column(Integer)
    acpl: Mapped[int | None] = mapped_column(Integer, nullable=True)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    phase_accuracy_opening: Mapped[float | None] = mapped_column(Float, nullable=True)
    phase_accuracy_middlegame: Mapped[float | None] = mapped_column(Float, nullable=True)
    phase_accuracy_endgame: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Madde 2026-09-14: kusurlu/hata/vahim-hata olarak işaretlenen HER
    # hamle — [{ply, fen_before, played_san, best_move, cp_loss, severity}].
    # "Hatalarını Gözden Geçir" bu listeyi MovePieceSolver egzersizlerine
    # çevirir; ayrı bir Puzzle satırı OLUŞTURULMAZ (o, admin küratörlüğündeki
    # bambaşka bir bulmaca bankası — bkz. models/puzzle.py).
    mistake_moves_json: Mapped[list] = mapped_column(JSON, default=list)
    # Madde 2026-09-14 (sunucu analiz motoru): HER ply için ham motor
    # skoru — [{ply, cp, mate}], hep BEYAZ açısından. mistake_moves_json
    # SADECE eşik aşan (sporcunun) hamleleri tutar; bu alan HER ply'ı
    # (iki taraf da) tutar çünkü notasyon kalite işaretleri (?/??/!/!!,
    # bkz. apps/web/lib/chess/moveQuality.ts::classifyMoveQuality)
    # ardışık HER ply çiftine bakar, sadece hatalı olanlara değil.
    eval_by_ply_json: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
