from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator


class TournamentCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    # Lichess Arena modeli (2026-09-05): sabit tur sayisi yok, sabit SURE var.
    # Turnuva Olustur ekranindaki sure secenekleri 20 dk - 720 dk (12 saat)
    # arasinda (bkz. app/(child)/play/tournament/create/page.tsx DURATIONS).
    starts_at: datetime
    duration_minutes: int = Field(ge=5, le=720)

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
