"""Seed all 9 modules and Module 1's lessons. Idempotent.

Run with: python -m scripts.seed_curriculum
"""
import asyncio
import json
from pathlib import Path
from sqlalchemy import select
from chess_api.database import get_session_factory
from chess_api.models import Module, Lesson, LessonStep, LessonStepType


async def seed():
    data = json.loads(
        (Path(__file__).parent / "curriculum-data.json").read_text(encoding="utf-8")
    )
    session_factory = get_session_factory()
    async with session_factory() as db:
        # Modules
        for mod_data in data["modules"]:
            existing = await db.execute(
                select(Module).where(Module.order_index == mod_data["order"])
            )
            if existing.scalar_one_or_none():
                continue
            db.add(Module(
                order_index=mod_data["order"],
                name=mod_data["name"],
                description=mod_data["description"],
                icon=mod_data.get("icon", "default"),
            ))
        await db.commit()

        # Module 1 lessons
        m1 = await db.execute(select(Module).where(Module.order_index == 1))
        module_1 = m1.scalar_one()
        for lesson_data in data["module_1_lessons"]:
            existing = await db.execute(
                select(Lesson).where(
                    Lesson.module_id == module_1.id,
                    Lesson.order_index == lesson_data["order"],
                )
            )
            if existing.scalar_one_or_none():
                continue
            lesson = Lesson(
                module_id=module_1.id,
                order_index=lesson_data["order"],
                title=lesson_data["title"],
                estimated_minutes=lesson_data.get("estimated_minutes", 10),
            )
            db.add(lesson)
            await db.flush()
            for step_data in lesson_data["steps"]:
                db.add(LessonStep(
                    lesson_id=lesson.id,
                    order_index=step_data["order"],
                    type=LessonStepType(step_data["type"]),
                    content_json=step_data["content"],
                    correct_answer_json=step_data.get("correct_answer"),
                ))
        await db.commit()
        print("Seed completed.")


if __name__ == "__main__":
    asyncio.run(seed())
