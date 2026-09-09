from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from chess_api.models.user import UserRole


class ParentSignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=120)
    athlete_name: str | None = Field(default=None, min_length=2, max_length=80)


class AthleteCreateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=80)


def _validate_kvkk(v: bool) -> bool:
    if not v:
        raise ValueError("KVKK onayı gerekli")
    return v


class MemberSignupRequest(BaseModel):
    """Madde 2026-09-09 (Üyelik Girişi Yenileme): "Kayıt Ol" formunun
    "Üye" (Sporcu) yolu. `birth_date`'ten hesaplanan yaş 18+ ise sporcunun
    KENDİ hesabı (role=athlete), 18 altıysa velinin hesabı (role=parent) +
    sporcunun ChildProfile'ı oluşur — bkz. auth.py member_signup."""
    first_name: str = Field(min_length=2, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    phone: str = Field(min_length=6, max_length=30)
    email: EmailStr
    province: str = Field(min_length=2, max_length=60)
    lichess_username: str | None = Field(default=None, max_length=60)
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    birth_date: date
    father_name: str | None = Field(default=None, max_length=80)
    father_phone: str | None = Field(default=None, max_length=30)
    father_email: str | None = Field(default=None, max_length=255)
    mother_name: str | None = Field(default=None, max_length=80)
    mother_phone: str | None = Field(default=None, max_length=30)
    mother_email: str | None = Field(default=None, max_length=255)
    kvkk_consent: bool

    @field_validator("kvkk_consent")
    @classmethod
    def _kvkk(cls, v: bool) -> bool:
        return _validate_kvkk(v)

    @model_validator(mode="after")
    def _en_az_bir_veli(self):
        # Madde 3 (Zafer'in isteği): Anne veya Baba'dan EN AZ biri TAM
        # doldurulmalı — diğeri isteğe bağlı kalır.
        anne_dolu = bool(self.mother_name and self.mother_phone and self.mother_email)
        baba_dolu = bool(self.father_name and self.father_phone and self.father_email)
        if not anne_dolu and not baba_dolu:
            raise ValueError("Anne veya Baba bilgilerinden en az biri tam doldurulmalı")
        return self


class TeacherSignupRequestV2(BaseModel):
    """Madde 2026-09-09 (Üyelik Girişi Yenileme): "Kayıt Ol" formunun
    "Antrenör" yolu — veli bölümü YOK (bkz. auth.py teacher_signup)."""
    first_name: str = Field(min_length=2, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    phone: str = Field(min_length=6, max_length=30)
    email: EmailStr
    province: str = Field(min_length=2, max_length=60)
    lichess_username: str | None = Field(default=None, max_length=60)
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    kvkk_consent: bool

    @field_validator("kvkk_consent")
    @classmethod
    def _kvkk(cls, v: bool) -> bool:
        return _validate_kvkk(v)


class LoginRequest(BaseModel):
    # Madde 2026-09-09 (Üyelik Girişi Yenileme): alan adı "email" geriye
    # uyumluluk için AYNEN kaldı, ama artık e-posta VEYA kullanıcı adı
    # kabul ediyor — bu yüzden EmailStr DEĞİL, düz str (bkz. auth.py login,
    # User.email VEYA User.username eşleşmesine bakar).
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: UserRole
    name: str
    # Madde 2026-09-09 (Üyelik Girişi Yenileme): frontend bu alana bakıp
    # 'pending' ise otomatik giriş/yönlendirme YAPMAZ, "onay bekliyor"
    # mesajı gösterir — token teknik olarak dönse de get_current_user
    # zaten reddeder (bkz. dependencies/auth.py), bu SADECE UX için.
    approval_status: str = "approved"


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
    description: str
    topics: str | None = None
    lesson_count: int
    icon: str


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
    topics: str | None = None
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


def _strip_control_chars(v: str | None) -> str | None:
    """BUG FIX (2026-09-08): Zafer bir tablodan kopyala-yapıştır yaparken
    "isim" alanına TAB karakteriyle birleşik isim+açıklama yapıştırmıştı
    (ör. "Temel Düzey\\t(...)") — başlık tek karışık satır olarak görünmeye
    başladı. Tab/satır sonu karakterleri artık tek boşluğa çevrilip
    (name/description/topics'te) baştan/sondan kırpılıyor; kopyala-yapıştır
    kazası bir daha SESSİZCE veriye karışmaz."""
    if v is None:
        return None
    return " ".join(v.split())


class ModuleCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    topics: str | None = None
    icon: str = "default"

    @field_validator("name", "description", "topics", mode="before")
    @classmethod
    def _clean(cls, v: str | None) -> str | None:
        # mode="before": min_length/max_length kirpilmis DEGERE gore
        # dogrulansin diye kisitlardan ONCE calisir.
        return _strip_control_chars(v)


class ModuleUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    topics: str | None = None
    icon: str | None = None

    @field_validator("name", "description", "topics", mode="before")
    @classmethod
    def _clean(cls, v: str | None) -> str | None:
        # mode="before": min_length/max_length kirpilmis DEGERE gore
        # dogrulansin diye kisitlardan ONCE calisir.
        return _strip_control_chars(v)


class ReorderRequest(BaseModel):
    ordered_ids: list[int]


class LessonCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    estimated_minutes: int = 10
    icon: str | None = None


class LessonUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    estimated_minutes: int | None = None
    module_id: int | None = None  # verilirse ders bu düzeye taşınır
    icon: str | None = None


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
    icon: str | None = None


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
