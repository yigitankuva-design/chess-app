from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from chess_api.models.user import UserRole


class ParentSignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=120)
    athlete_name: str | None = Field(default=None, min_length=2, max_length=80)


class AthleteCreateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: UserRole
    name: str


class EmailVerifyRequest(BaseModel):
    token: str


class ChildProfileCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    age: int = Field(ge=4, le=18)
    pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")
    avatar: str = "default"


class ChildProfileResponse(BaseModel):
    id: int
    display_name: str
    age: int
    avatar: str
    teacher_user_id: int | None


class DeviceRegisterRequest(BaseModel):
    device_fingerprint: str
    name: str


class ChildPinLoginRequest(BaseModel):
    child_profile_id: int
    pin: str = Field(min_length=4, max_length=4)
    device_fingerprint: str


class ChildEnterRequest(BaseModel):
    child_profile_id: int
    device_fingerprint: str


class AdminResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8)


class AdminParentSummary(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime
    child_count: int
    child_names: list[str] = []


class AdminChildSummary(BaseModel):
    id: int
    display_name: str
    age: int
    avatar: str
    completed_lessons: int


class AdminParentDetail(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime
    children: list[AdminChildSummary]


class AdminOverview(BaseModel):
    total_parents: int
    total_children: int
    total_teachers: int


class AdminModuleSummary(BaseModel):
    id: int
    order_index: int
    name: str
    lesson_count: int


class AdminLessonSummary(BaseModel):
    id: int
    order_index: int
    title: str
    estimated_minutes: int
    step_count: int


class ContentStepIO(BaseModel):
    id: int | None = None
    order_index: int
    type: str
    content_json: dict
    correct_answer_json: dict | None = None


class ContentLessonIO(BaseModel):
    id: int | None = None
    order_index: int
    title: str = Field(min_length=1, max_length=160)
    estimated_minutes: int = 10
    steps: list[ContentStepIO] = []


class ContentModuleIO(BaseModel):
    id: int | None = None
    order_index: int
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    icon: str = "default"
    lessons: list[ContentLessonIO] = []


class ContentExport(BaseModel):
    exported_at: datetime
    version: int = 1
    modules: list[ContentModuleIO]


class ContentImportRequest(BaseModel):
    version: int
    modules: list[ContentModuleIO]


class ContentImportResult(BaseModel):
    modules_updated: int
    modules_created: int
    lessons_updated: int
    lessons_created: int
    steps_updated: int
    steps_created: int


class ModuleCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    icon: str = "default"


class ModuleUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    icon: str | None = None


class ReorderRequest(BaseModel):
    ordered_ids: list[int]


class LessonCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    estimated_minutes: int = 10


class LessonUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    estimated_minutes: int | None = None
    module_id: int | None = None  # verilirse ders bu düzeye taşınır


class LessonPublishRequest(BaseModel):
    published: bool


class AdminLessonDetail(BaseModel):
    id: int
    module_id: int
    order_index: int
    title: str
    estimated_minutes: int
    published: bool
    step_count: int


class StepCreateRequest(BaseModel):
    type: str
    content_json: dict
    correct_answer_json: dict | None = None


class StepUpdateRequest(BaseModel):
    content_json: dict | None = None
    correct_answer_json: dict | None = None
    lesson_id: int | None = None  # verilirse adım bu derse taşınır


class AdminStepDetail(BaseModel):
    id: int
    lesson_id: int
    order_index: int
    type: str
    content_json: dict
    correct_answer_json: dict | None = None
