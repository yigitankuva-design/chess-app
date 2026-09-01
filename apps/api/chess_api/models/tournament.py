import enum
from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, Enum, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class TournamentStatus(str, enum.Enum):
    upcoming = "upcoming"
    active = "active"
    finished = "finished"


class TournamentType(str, enum.Enum):
    """Madde 2026-09-10: Arena (sürekli, süre bazlı) turnuvaların yanına
    İSVİÇRE usulü (sabit tur sayısı, tur-tur eşleştirme) ikinci bir mod
    olarak geri geldi — bkz. services/swiss.py."""
    arena = "arena"
    swiss = "swiss"


class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # Madde 2026-09-09 (4): silme yetkisi artık SADECE bu sporcuya ait —
    # created_by_user_id (hoca/veli grubu) görünürlük/gruplama içindi, kimin
    # SİLEBİLECEĞİNİ artık bu alan belirler. Eski turnuvalarda NULL (zaten
    # başlamış/bitmiş oldukları için yeni "başlamadan önce" kuralına takılıp
    # öyle de silinemezler).
    created_by_child_id: Mapped[int | None] = mapped_column(
        ForeignKey("child_profiles.id"), nullable=True, index=True,
    )
    base_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    increment_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Madde 6 (2026-08-20): Puanli turnuvada maclar Performans Puanini
    # etkiler. Varsayilan False — mevcut turnuvalar etkilenmez.
    rated: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    status: Mapped[TournamentStatus] = mapped_column(
        Enum(TournamentStatus), default=TournamentStatus.upcoming,
    )
    # Madde 2026-09-10: Arena (varsayılan, geriye dönük uyumlu) VEYA İsviçre.
    tournament_type: Mapped[TournamentType] = mapped_column(
        Enum(TournamentType), nullable=False,
        default=TournamentType.arena, server_default="arena",
    )
    # SADECE İsviçre'de dolu — toplam tur sayısı / şu anki tur (0 = henüz
    # başlamadı). Arena'da ikisi de NULL kalır.
    rounds_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_round: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0, server_default="0")
    # Madde 2026-09-XX: "Tur Arası Süre" — SADECE İsviçre'de dolu (5/10/15/30
    # dakikadan biri, turnuva oluştururken kurucu seçer). Bir tur biterken
    # (tüm eşleşmeler sonuçlanınca) sıradaki tur ANINDA değil, bu kadar süre
    # sonra üretilir — küçük yaştaki sporculara maçlar arası nefes payı.
    # Eski (bu alandan ÖNCE oluşturulmuş) turnuvalarda NULL kalır — geriye
    # dönük uyum için 0 dakika (anında geçiş, eski davranış) gibi davranılır.
    round_gap_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Şu anki tur ne zaman "hazır" (tüm eşleşmeleri sonuçlanmış) hale geldi —
    # tur arası bekleme süresinin BAŞLANGIÇ anını tutar. Sıradaki tur
    # üretilince NULL'a döner (services/swiss.py::advance_swiss_tournament).
    round_ready_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # "Berserk" (2026-09-10): SADECE arena + Yıldırım/Hızlı tempoda etkindir
    # (bkz. services/tempo.py::tempo_category) — kontrol routers/live_game.py
    # _handle_berserk'te yapılır, burada sadece sporcunun TERCİHİ tutulur.
    berserk_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    # Lichess Arena modeli (2026-09-05): sabit tur yok, sabit SÜRE var.
    # ends_at DB'de tutulmaz — starts_at + duration_minutes'tan hesaplanır.
    # Madde 2026-09-10: İsviçre'de anlamsız (bitiş tur sayısına bağlı) — NULL
    # olabilir, bu yüzden nullable yapıldı (arena'da hâlâ zorunlu, şemada
    # NOT NULL kalmıyor ama pydantic/route seviyesinde arena için zorunlu).
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Madde 2026-09-06 (turnuva oluşturma ekranı): serbest metin açıklama.
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Tum eslesmeler bu FEN'den baslar (bos/None = standart baslangic) —
    # hoca/sporcu belirli bir acilis/varyanti tema olarak secebilsin diye.
    start_fen: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # "Galibiyet Odulu" (2026-09-06): acik iken 2 galibiyet ust uste gelince
    # sonraki sonuc katlanir (bkz. services/tournaments.py::_apply_arena_points);
    # kapaliysa hep duz 2/1/0 puanlanir. Varsayilan True — mevcut davranis degismez.
    winning_streak_bonus: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class TournamentParticipant(Base):
    __tablename__ = "tournament_participants"

    id: Mapped[int] = mapped_column(primary_key=True)
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"), index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    # Lichess Arena puanlamasi: galibiyet=2, beraberlik=1, kayip=0 — 2 galibiyet
    # ust uste gelince "seri" aktiflesir, seri aktifken sonraki sonuc katlanir.
    score: Mapped[float] = mapped_column(Float, default=0.0)
    # Ust uste kac galibiyet — 2'ye ulasinca sonraki sonuc (bu dahil) katlanir;
    # beraberlik/kayip sifirlar.
    current_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Madde 2026-09-09 (5): "çekilme" satırı SİLMEZ, bu alanı doldurur —
    # rakiplerinin Sonneborn-Berger hesabı çekilenin dondurulmuş puanını
    # görmeye devam eder (bkz. services/tournaments.py). NULL = hâlâ katılımcı.
    left_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Madde 2026-09-10 (İsviçre): kaç kez "bay" (rakipsiz otomatik galibiyet)
    # aldı — sıradaki bay'ı verirken bunu HİÇ almamışlar tercih edilir.
    bye_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    # Madde 2026-09-XX (İsviçre geç katılım): katıldığı ANDA turnuva zaten
    # "upcoming" değilse (1. tur üretilmiş) True — bay puanlaması bunu okur
    # (geç katılana 0,5, baştan beri orada olana 1,0 — bkz. services/
    # tournaments.py::_apply_swiss_bye_points). routers/tournaments.py::
    # join_tournament yazar, tekrar katılımda (left_at temizlenince)
    # DEĞİŞTİRİLMEZ (ilk katılım anı geçerli kalır).
    late_joiner: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")


class TournamentPairing(Base):
    __tablename__ = "tournament_pairings"

    id: Mapped[int] = mapped_column(primary_key=True)
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"), index=True)
    white_child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    # Arena'da bay gecme yok — kuyrukta yalniz kalan sporcu rakip gelene kadar
    # bekler, bu yuzden black_child_id hep dolu (eslesme aninda olusturulur).
    black_child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    # Eslesme aninda mac da olusturulur, bu yuzden hep dolu.
    # ON DELETE SET NULL: child_deletion.py bir maci hard-delete ederse bu
    # satir "oynanmamis" gibi kalir, patlamaz (KURAL #3).
    game_id: Mapped[int | None] = mapped_column(
        ForeignKey("games.id", ondelete="SET NULL"), nullable=True,
    )
    # '1-0' | '0-1' | '1/2-1/2' | 'void' (iptal — bkz. services/tournaments.py)
    # | None (henuz sonuclanmadi).
    result: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Madde 2026-09-10: SADECE İsviçre'de dolu — hangi turda oynandığı
    # (arena'da hep NULL, kronolojik sıra zaten artan id ile korunur).
    round_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # "Berserk" (2026-09-10): bu taraf BU maçta berserk yaptı mı — hem
    # tekrar berserk yapmasını engellemek hem puanlama bonusu için.
    white_berserked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    black_berserked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
