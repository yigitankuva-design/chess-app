import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Enum, Text
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
    # Madde 2026-09-07 (Antrenör Paneli, 4): antrenörün KENDİ Profil
    # sayfasındaki kimlik fotoğrafı — ChildProfile.photo_data_url ile AYNI
    # desen (data:image/...;base64,... — bkz. POST /teacher/me/photo).
    # NULLABLE (mevcut hesaplarda boş; KURAL #3) — boşsa sabit 🎓 rozeti
    # gösterilmeye devam eder.
    photo_data_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 1): yeni "Kayıt Ol"
    # formunun eklediği alanlar — hepsi NULLABLE (mevcut hesaplarda boş;
    # KURAL #3). `username`: e-postanın YANINDA kullanılabilen ikinci giriş
    # kimliği (bkz. /auth/login — e-posta VEYA kullanıcı adı kabul eder).
    # `phone`/`province`/`lichess_username`: antrenörün (veya 18+ kendi
    # kaydolan sporcunun) kendi iletişim bilgileri — ChildProfile'daki
    # AYNI isimli alanlarla (athlete_phone/province/vb.) AYNI amaç, farklı
    # tablo (User = antrenör/18+ sporcu, ChildProfile = veli-yönetimli
    # sporcu). `kvkk_consent_at`: KVKK onay kutusunun ARTIK backend'e
    # kaydedilen zaman damgası (öncesinde sadece frontend'de tutulup
    # atılıyordu). `approval_status`: 18+ kendi kaydolan sporcu hesapları
    # 'pending' ile başlar (admin onaylayana kadar giriş yapamaz — madde
    # 2026-09-09, "yaş beyanı" riskine karşı Tier A önlemi); veli/antrenör
    # hesapları DB varsayılanıyla 'approved' başlar (zaten bir yetişkin
    # sorumluluk alıyor, ek onay gerekmez).
    username: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    province: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    lichess_username: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    kvkk_consent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    approval_status: Mapped[str] = mapped_column(String(20), server_default="approved")
