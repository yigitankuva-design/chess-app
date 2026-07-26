from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class PoolImage(Base):
    """Görsel havuzu — soru görseli seçerken kategoriye göre gözatılan görseller.

    Kismen tohum veri (scripts/seed_pool_images.py), kismen Zafer Hoca'nin
    "Bilgisayardan Sec" sonrasi havuza ekledigi kullanici verisidir.

    data_uri Text'tir (String degil): data-URI'ler 400KB'a kadar cikabiliyor.
    """

    __tablename__ = "pool_images"
    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(40))
    data_uri: Mapped[str] = mapped_column(Text)
