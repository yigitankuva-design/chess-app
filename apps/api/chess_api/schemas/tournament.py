from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator


class TournamentCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    starts_at: datetime
    # Madde 2026-09-10: Arena'da ZORUNLU (5-720 dk), İsviçre'de kullanılmaz
    # (None'a zorlanır) — bkz. _type_specific_fields. Lichess Arena modeli
    # (2026-09-05): sabit tur sayisi yok, sabit SURE var. Turnuva Olustur
    # ekranindaki sure secenekleri 20 dk - 720 dk (12 saat) arasinda (bkz.
    # app/(child)/play/tournament/create/page.tsx DURATIONS).
    duration_minutes: int | None = Field(default=None, ge=5, le=720)

    @field_validator("starts_at")
    @classmethod
    def _naive_utc_starts_at(cls, v: datetime) -> datetime:
        """BUG FIX (2026-09-07): tarayici `new Date(...).toISOString()` ile
        "Z" ekli (tz-AWARE) bir tarih gonderir. tournaments.starts_at kolonu
        duz DateTime (timezone=False) — asyncpg AWARE bir datetime'i bu tur
        kolona yazmaya calisirken 'timestamp cannot be aware' hatasi ATAR ve
        istek 500 ile patlar (sqlite kullanan testler bu hatayi YAKALAMAZ,
        bu yuzden test kapisinden gecmisti). Burada AWARE gelen deger UTC'ye
        cevrilip tzinfo silinir; NAIVE gelen (eski/dogrudan API cagrilari)
        degismeden birakilir (zaten UTC varsayilir, mevcut convention)."""
        if v.tzinfo is not None:
            return v.astimezone(timezone.utc).replace(tzinfo=None)
        return v
    base_ms: int | None = None
    increment_ms: int | None = None
    # Madde 6 (2026-08-20): Puanlı turnuvada maçlar Performans Puanını
    # etkiler — yalnızca base_ms/increment_ms sabit 9 tempodan birine tam
    # eşleşirse (services/tempo.py); eşleşmezse rated=True olsa da etkisiz.
    rated: bool = False
    # Madde 2026-09-06 ("Turnuva Oluştur" ekranı — Zafer'in gönderdiği görsel):
    description: str | None = Field(default=None, max_length=2000)
    # Tum eslesmeler bu FEN'den baslar; bos/None = standart baslangic.
    start_fen: str | None = Field(default=None, max_length=100)
    # "Galibiyet Ödülü": acikken seri (2 galibiyet ust uste) sonraki sonucu
    # katlar; kapaliysa hep duz 2/1/0.
    winning_streak_bonus: bool = True
    # Madde 2026-09-10 ("Turnuva Türü" / "Berserk" kartları):
    tournament_type: Literal["arena", "swiss"] = "arena"
    # Madde 2026-09-XX: artık sporcu SEÇMİYOR — İsviçre'de katılım kapanıp
    # 1. tur üretilirken katılımcı sayısına göre OTOMATİK hesaplanır (bkz.
    # services/swiss.py::_start_round). Burada gönderilen değer (varsa) HER
    # ZAMAN yok sayılır (_type_specific_fields None'a zorlar) — client'in
    # eski/hatalı bir değer göndermesi turnuvayı bozmasın diye.
    rounds_total: int | None = Field(default=None, ge=2, le=15)
    # SADECE arena + Yıldırım/Hızlı tempoda gerçekten etkin olur (kontrol
    # routers/live_game.py::_handle_berserk'te) — burada sadece tercih.
    berserk_enabled: bool = False

    @model_validator(mode="after")
    def _type_specific_fields(self) -> "TournamentCreateRequest":
        """Arena ve İsviçre'nin süre/tur alanları KARŞILIKLI DIŞLAR —
        birinin zorunlu olduğu yerde diğeri anlamsız, o yüzden sessizce
        None'a zorlanır (yanlışlıkla ikisi birden gönderilirse DB'de tutarsız
        kalmasın).

        Madde 2026-09-XX: İsviçre'de "Galibiyet Ödülü" (seri katlaması) ve
        "Berserk" hiç kullanılmıyor — Zafer'in kararı. Client ne gönderirse
        göndersin (ör. eski bir ekran/yanlış payload) burada zorla False'a
        çekilir; sadece frontend'in devre dışı bırakması yetmez, backend de
        bağımsız olarak garanti eder."""
        if self.tournament_type == "swiss":
            self.duration_minutes = None
            self.rounds_total = None
            self.winning_streak_bonus = False
            self.berserk_enabled = False
        else:
            if self.duration_minutes is None:
                raise ValueError("Turnuva süresi zorunludur")
            self.rounds_total = None
        return self
