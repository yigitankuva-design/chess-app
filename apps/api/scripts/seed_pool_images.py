"""Görsel havuzu tohum verisini yükler. Idempotent (category+data_uri ile atlar).

Calistirma: python -m scripts.seed_pool_images

Migration DEGILDIR — sema degisikligi migration'da, veri burada (mevcut
seed_badges.py / seed_curriculum.py ile ayni desen).
"""
import asyncio
import json
from pathlib import Path

from sqlalchemy import select

from chess_api.database import get_session_factory
from chess_api.models import PoolImage

DATA = Path(__file__).parent / "pool-images-data.json"


async def seed() -> None:
    rows = json.loads(DATA.read_text(encoding="utf-8"))
    session_factory = get_session_factory()
    added = 0
    async with session_factory() as db:
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
    print(f"Havuz tohumlandi: {added} yeni, {len(rows) - added} zaten vardi.")


if __name__ == "__main__":
    asyncio.run(seed())
