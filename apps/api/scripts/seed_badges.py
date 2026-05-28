"""Seed badge definitions. Idempotent (skip by slug). Run: python -m scripts.seed_badges"""
import asyncio
import json
from pathlib import Path
from sqlalchemy import select
from chess_api.database import get_session_factory
from chess_api.models import Badge


async def seed():
    data = json.loads((Path(__file__).parent / "badges-data.json").read_text(encoding="utf-8"))
    session_factory = get_session_factory()
    async with session_factory() as db:
        for b in data:
            existing = await db.execute(select(Badge).where(Badge.slug == b["slug"]))
            if existing.scalar_one_or_none():
                continue
            db.add(Badge(
                slug=b["slug"], name_tr=b["name_tr"], description_tr=b["description_tr"],
                icon=b["icon"], criteria_json=b["criteria"],
            ))
        await db.commit()
        print("Badges seeded.")


if __name__ == "__main__":
    asyncio.run(seed())
