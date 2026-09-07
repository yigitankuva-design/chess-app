import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class UserRole(str, enum.Enum):
    parent = "parent"
    teacher = "teacher"
    athlete = "athlete"
    # Madde 2026-09-07 (Antrenör Paneli, 5): gerçek yönetici (Zafer) artık
    # "teacher" rolünden AYRI — Kayıt Ol formundan asla üretilemez, sadece
    # veritabanında elle atanır. "teacher" bundan böyle SADECE kendi
    # antrenör panelini kullanan sıradan antrenör hesaplarını ifade eder.
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole))
    name: Mapped[str] = mapped_column(String(120))
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verification_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
