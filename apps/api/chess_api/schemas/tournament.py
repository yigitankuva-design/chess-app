from datetime import datetime
from pydantic import BaseModel, Field


class TournamentCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    # Lichess Arena modeli (2026-09-05): sabit tur sayisi yok, sabit SURE var.
    starts_at: datetime
    duration_minutes: int = Field(ge=5, le=240)
    base_ms: int | None = None
    increment_ms: int | None = None
    # Madde 6 (2026-08-20): Puanlı turnuvada maçlar Performans Puanını
    # etkiler — yalnızca base_ms/increment_ms sabit 9 tempodan birine tam
    # eşleşirse (services/tempo.py); eşleşmezse rated=True olsa da etkisiz.
    rated: bool = False
