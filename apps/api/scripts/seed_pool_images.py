"""Görsel havuzu tohum verisini yükler. Idempotent (category+data_uri ile atlar).

Calistirma: python -m scripts.seed_pool_images

Migration DEGILDIR — sema degisikligi migration'da, veri burada (mevcut
seed_badges.py / seed_curriculum.py ile ayni desen).

ESKI TOHUMLARIN TEMIZLIGI (madde 3c):
Ikonlar vektorel surumle yeniden uretildi ve "Gok Cisimleri" kategorisi
kaldirildi. Eski tohumlar panoda kalmasin diye siliniyorlar — ama SADECE
pool-images-legacy.json'daki data_uri'lerle BIREBIR eslesenler.

Neden birebir eslesme: "tohum listesinde olmayan her satiri sil" demek Zafer
Hoca'nin KENDI yukledigi gorselleri de silerdi. Eski tohumun tam listesi
elimizde oldugu icin yalnizca onlari hedefliyoruz — hocanin yukledigi hicbir
gorsel etkilenmez.

Bir soruya eklenmis gorseller de ETKILENMEZ: soru, gorseli kendi JSON'una
kopyalar; havuz satirina bagli degildir (KURAL #3).
"""
import asyncio
import json
from pathlib import Path

from sqlalchemy import select

from chess_api.database import get_session_factory
from chess_api.models import PoolImage

HERE = Path(__file__).parent
DATA = HERE / "pool-images-data.json"
LEGACY = HERE / "pool-images-legacy.json"


async def seed() -> None:
    rows = json.loads(DATA.read_text(encoding="utf-8"))
    legacy = json.loads(LEGACY.read_text(encoding="utf-8")) if LEGACY.exists() else []
    fresh_uris = {r["data_uri"] for r in rows}
    # Yeni tohumda da bulunan bir eski URI varsa SILINMEZ (degismemis ikon).
    legacy_uris = {r["data_uri"] for r in legacy} - fresh_uris

    session_factory = get_session_factory()
    added = 0
    removed = 0
    async with session_factory() as db:
        if legacy_uris:
            old = (await db.execute(
                select(PoolImage).where(PoolImage.data_uri.in_(legacy_uris))
            )).scalars().all()
            for row in old:
                await db.delete(row)
                removed += 1

        for row in rows:
            existing = await db.execute(
                select(PoolImage).where(
                    PoolImage.category == row["category"],
                    PoolImage.data_uri == row["data_uri"],
                )
            )
            if existing.scalars().first():
                continue
            db.add(PoolImage(category=row["category"], data_uri=row["data_uri"]))
            added += 1
        await db.commit()
    print(f"Havuz tohumlandi: {added} yeni, {len(rows) - added} zaten vardi, "
          f"{removed} eski tohum silindi.")


if __name__ == "__main__":
    asyncio.run(seed())
