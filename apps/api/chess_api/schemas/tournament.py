from pydantic import BaseModel, Field


class TournamentCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    rounds_total: int = Field(ge=1, le=20)
    base_ms: int | None = None
    increment_ms: int | None = None
    # Madde 6 (2026-08-20): Puanlı turnuvada maçlar Performans Puanını
    # etkiler — yalnızca base_ms/increment_ms sabit 9 tempodan birine tam
    # eşleşirse (services/tempo.py); eşleşmezse rated=True olsa da etkisiz.
    rated: bool = False
