from datetime import datetime
from pydantic import BaseModel, Field


class TournamentCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    # Lichess Arena modeli (2026-09-05): sabit tur sayisi yok, sabit SURE var.
    # Turnuva Olustur ekranindaki sure secenekleri 20 dk - 720 dk (12 saat)
    # arasinda (bkz. app/(child)/play/tournament/create/page.tsx DURATIONS).
    starts_at: datetime
    duration_minutes: int = Field(ge=5, le=720)
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
