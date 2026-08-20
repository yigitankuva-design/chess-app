from pydantic import BaseModel, Field


class TournamentCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    rounds_total: int = Field(ge=1, le=20)
    base_ms: int | None = None
    increment_ms: int | None = None
