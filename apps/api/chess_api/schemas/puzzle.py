from pydantic import BaseModel


class PuzzleResponse(BaseModel):
    id: int
    fen: str
    moves: list[str]
    rating: int
    themes: list[str]  # TR names


class PuzzleAttemptRequest(BaseModel):
    success: bool
    time_seconds: int = 0
    moves_attempted: list[str] = []


class PuzzleAttemptResponse(BaseModel):
    accepted: bool
