"""
Dersleri ve ders adımlarını temizler, 4 modülü yeni isimlerle günceller.
9 modül → 4 düzey (Temel / Başlangıç / Orta / İleri).
Çalıştır: railway run python -m scripts.reset_curriculum
"""
import asyncio
from sqlalchemy import text
from chess_api.database import get_session_factory

NEW_MODULES = [
    {"order": 1, "name": "Temel Düzey",       "description": "Satranç tahtası, taşlar ve temel kurallar", "icon": "🌱"},
    {"order": 2, "name": "Başlangıç Düzeyi",  "description": "Temel taktikler ve oyun prensipleri",       "icon": "😊"},
    {"order": 3, "name": "Orta Düzey",         "description": "Açılışlar, pozisyonel oyun ve son oyun",    "icon": "😎"},
    {"order": 4, "name": "İleri Düzey",        "description": "İleri taktikler, strateji ve turnuva hazırlığı", "icon": "🔥"},
]


async def reset():
    factory = get_session_factory()
    async with factory() as db:
        # 1) Tüm ders adımlarını sil
        await db.execute(text("DELETE FROM lesson_steps"))
        # 2) Tüm dersleri sil
        await db.execute(text("DELETE FROM lessons"))
        # 3) Modülleri temizle (hepsini sil, sonra 4'ünü ekle)
        await db.execute(text("DELETE FROM modules"))
        await db.commit()

        # 4) 4 yeni modülü ekle
        for m in NEW_MODULES:
            await db.execute(
                text("""
                    INSERT INTO modules (order_index, name, description, icon)
                    VALUES (:order, :name, :desc, :icon)
                """),
                {"order": m["order"], "name": m["name"], "desc": m["description"], "icon": m["icon"]},
            )
        await db.commit()
        print("✅ Curriculum sıfırlandı. 4 modül oluşturuldu, dersler boş.")


if __name__ == "__main__":
    asyncio.run(reset())
