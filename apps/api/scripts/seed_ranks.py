"""Seed rank definitions. Idempotent (skip by order_index). Run: python -m scripts.seed_ranks"""
import asyncio
import json
from pathlib import Path
from sqlalchemy import select
from chess_api.database import get_session_factory
from chess_api.models import Rank


async def seed():
    data = json.loads((Path(__file__).parent / "ranks-data.json").read_text(encoding="utf-8"))
    session_factory = get_session_factory()
    async with session_factory() as db:
        for r in data:
            existing = await db.execute(select(Rank).where(Rank.order_index == r["order"]))
            if existing.scalar_one_or_none():
                continue
            db.add(Rank(
                order_index=r["order"], name_tr=r["name_tr"],
                xp_required=r["xp_required"], icon=r["icon"],
            ))
        await db.commit()
        print("Ranks seeded.")


if __name__ == "__main__":
    asyncio.run(seed())
