"""Seed puzzles from the committed gzipped CSV. Idempotent (skips existing lichess_id).

Run with: python -m scripts.seed_puzzles
"""
import asyncio
import csv
import gzip
import json
from pathlib import Path
from sqlalchemy import select
from chess_api.database import get_session_factory
from chess_api.models import Puzzle, PuzzleTheme

# Theme slug -> module order_index (from spec section 7)
THEME_TO_MODULE = {
    "fork": 3, "attraction": 3, "defensiveMove": 3, "pin": 3, "skewer": 3,
    "capturingDefender": 4, "hangingPiece": 4, "xRayAttack": 4,
    "kingsideAttack": 5, "queensideAttack": 5, "sacrifice": 5,
    "doubleCheck": 6,
    "discoveredAttack": 7,
    "interference": 8,
    "mateIn1": 9, "mateIn2": 9, "mateIn3": 9, "backRankMate": 9, "smotheredMate": 9,
}

SCRIPT_DIR = Path(__file__).parent


async def seed():
    themes_tr = json.loads((SCRIPT_DIR / "puzzle-themes-tr.json").read_text(encoding="utf-8"))
    session_factory = get_session_factory()

    async with session_factory() as db:
        # 1. Ensure themes exist; cache id by slug
        theme_id_by_slug: dict[str, int] = {}
        for slug, info in themes_tr.items():
            existing = await db.execute(select(PuzzleTheme).where(PuzzleTheme.slug == slug))
            theme = existing.scalar_one_or_none()
            if not theme:
                theme = PuzzleTheme(slug=slug, name_tr=info["name_tr"],
                                    description_tr=info.get("description_tr") or None)
                db.add(theme)
                await db.flush()
            theme_id_by_slug[slug] = theme.id
        await db.commit()

        # 2. Load module id by order_index (modules already seeded by seed_curriculum)
        from chess_api.models import Module
        module_rows = (await db.execute(select(Module))).scalars().all()
        module_id_by_order = {m.order_index: m.id for m in module_rows}

        # 3. Existing lichess ids (to skip)
        existing_ids = set(
            (await db.execute(select(Puzzle.lichess_id))).scalars().all()
        )

        # 4. Stream the gzipped CSV
        csv_path = SCRIPT_DIR / "puzzles_seed.csv.gz"
        inserted = 0
        batch = []
        with gzip.open(csv_path, "rt", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                lid = row["PuzzleId"]
                if lid in existing_ids:
                    continue
                slugs = (row.get("Themes") or "").split()
                module_order = next((THEME_TO_MODULE[s] for s in slugs if s in THEME_TO_MODULE), None)
                module_id = module_id_by_order.get(module_order) if module_order else None

                puzzle = Puzzle(
                    lichess_id=lid,
                    fen=row["FEN"],
                    moves_json=row["Moves"].split(),
                    rating=int(row["Rating"]),
                    popularity=int(row["Popularity"]),
                    module_id=module_id,
                )
                # attach themes
                for s in slugs:
                    tid = theme_id_by_slug.get(s)
                    if tid:
                        tobj = await db.get(PuzzleTheme, tid)
                        puzzle.themes.append(tobj)
                batch.append(puzzle)

                if len(batch) >= 500:
                    db.add_all(batch)
                    await db.commit()
                    inserted += len(batch)
                    batch = []
                    print(f"  inserted {inserted}...")

            if batch:
                db.add_all(batch)
                await db.commit()
                inserted += len(batch)

        print(f"Total puzzles inserted: {inserted}")


if __name__ == "__main__":
    asyncio.run(seed())
