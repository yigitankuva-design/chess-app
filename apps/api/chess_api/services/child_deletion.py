"""Bir çocuk profilini tüm bağımlı kayıtlarıyla birlikte FK-güvenli sırada siler.

Hem veli (children router) hem admin (admin router) silme akışları bunu kullanır.
"""
from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import (
    ChildProfile,
    ChildLessonProgress, ChildLessonStepResult,
    ChildPuzzleAttempt, SRSCard, ChildBadge, ChildRank,
    ParentTimeLimit, ChildActivityLog, ParentSurveyResponse,
    Game, GameMove, Device,
    TournamentParticipant, TournamentPairing,
)


async def delete_child_cascade(db: AsyncSession, child: ChildProfile) -> None:
    """child'a bağlı tüm satırları siler ve child'ı siler. commit ETMEZ — çağıran commit eder."""
    child_id = child.id

    # Turnuva baglantilari — Game silinmeden ONCE temizlenir. Uygulama
    # katmaninda ACIKCA yapilir (DB'nin ON DELETE SET NULL'una guvenmek
    # SQLite testlerinde FK zorlamasi kapali oldugu icin sessizce
    # dogrulanmadan gecebilirdi). Bu cocugun taraf oldugu eslesmeler
    # tamamen silinir — turnuvadaki izi de gitmis olur (nadir, hesap
    # silme ani icin kabul edilebilir bir basitlestirme).
    await db.execute(delete(TournamentPairing).where(
        (TournamentPairing.white_child_id == child_id) | (TournamentPairing.black_child_id == child_id)
    ))
    await db.execute(delete(TournamentParticipant).where(TournamentParticipant.child_id == child_id))

    game_ids = (await db.execute(
        select(Game.id).where(
            (Game.white_child_id == child_id) | (Game.black_child_id == child_id)
        )
    )).scalars().all()

    if game_ids:
        await db.execute(delete(GameMove).where(GameMove.game_id.in_(game_ids)))
    await db.execute(delete(GameMove).where(GameMove.by_child_id == child_id))
    if game_ids:
        await db.execute(delete(Game).where(Game.id.in_(game_ids)))

    await db.execute(delete(ChildLessonStepResult).where(ChildLessonStepResult.child_id == child_id))
    await db.execute(delete(ChildLessonProgress).where(ChildLessonProgress.child_id == child_id))
    await db.execute(delete(ChildPuzzleAttempt).where(ChildPuzzleAttempt.child_id == child_id))
    await db.execute(delete(SRSCard).where(SRSCard.child_id == child_id))
    await db.execute(delete(ChildBadge).where(ChildBadge.child_id == child_id))
    await db.execute(delete(ChildRank).where(ChildRank.child_id == child_id))
    await db.execute(delete(ParentTimeLimit).where(ParentTimeLimit.child_id == child_id))
    await db.execute(delete(ChildActivityLog).where(ChildActivityLog.child_id == child_id))

    # Nullable FK'ler — parent tarafı kaydı kalsın, sadece child bağını kopar
    await db.execute(
        update(ParentSurveyResponse)
        .where(ParentSurveyResponse.child_id == child_id)
        .values(child_id=None)
    )
    await db.execute(
        update(Device)
        .where(Device.active_child_profile_id == child_id)
        .values(active_child_profile_id=None)
    )

    await db.delete(child)
