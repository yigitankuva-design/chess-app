from pydantic import BaseModel
from chess_api.models.module import LessonStepType


class ModuleResponse(BaseModel):
    id: int
    order_index: int
    name: str
    description: str
    icon: str
    lessons_count: int


class LessonStepResponse(BaseModel):
    id: int
    order_index: int
    type: LessonStepType
    content_json: dict
    # correct_answer_json deliberately omitted — only server validates


class LessonDetailResponse(BaseModel):
    id: int
    module_id: int
    title: str
    estimated_minutes: int
    steps: list[LessonStepResponse]


class StepAnswerRequest(BaseModel):
    answer_json: dict
    time_seconds: int = 0


class StepAnswerResponse(BaseModel):
    correct: bool
    next_step_index: int | None
    lesson_completed: bool
