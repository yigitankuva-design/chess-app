"""Aday Hamle Pratiği — sporcu tarafı REST uçları (madde 2026-09-16).

Motor burada ASLA çalışmaz — sadece admin'in "Analiz Et" ile bir kez
bulup kaydettiği `candidate_moves` (cevap anahtarı) ile sporcunun UCI
hamlelerinin HIZLI karşılaştırılması. Havuz, oturum başında `pool_snapshot`
olarak dondurulur (admin sonradan havuzu değiştirse bile bu oturum
etkilenmez) ve admin'in kaydettiği SIRAYLA, tekrarsız gezilir.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models import ChildProfile, CustomTabSection, ChildAdayHamleSession

router = APIRouter(prefix="/aday-hamle", tags=["aday-hamle"])

# apps/web/lib/customTabs/pratikYap.ts::ADAY_HAMLE_KIND ile AYNI sabit.
ADAY_HAMLE_KIND = "aday_hamle"


class CreateSessionRequest(BaseModel):
    section_id: int
    duration_minutes: int = Field(gt=0, le=60)


class AnswerRequest(BaseModel):
    moves: list[str] = Field(min_length=3, max_length=3)


def _position_payload(pos: dict) -> dict:
    # id de döner — frontend "Kontrol Et" ekranında hangi admin-pozisyonunun
    # bu olduğunu (ve dolayısıyla candidate_moves'unu, zaten elindeki
    # practice_positions prop'undan) eşleştirebilsin diye.
    return {"id": pos["id"], "fen": pos["fen"]}


async def _get_owned_session(
    session_id: int, child: ChildProfile, db: AsyncSession,
) -> ChildAdayHamleSession:
    session = await db.get(ChildAdayHamleSession, session_id)
    if not session or session.child_id != child.id:
        raise HTTPException(404, "Oturum bulunamadı")
    return session


@router.post("/sessions", status_code=201)
async def create_session(
    payload: CreateSessionRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    section = await db.get(CustomTabSection, payload.section_id)
    if not section or section.section_kind != ADAY_HAMLE_KIND:
        raise HTTPException(400, "Bu bölüm Aday Hamle Pratiği değil")

    # SADECE cevap anahtarı (candidate_moves) kaydedilmiş pozisyonlar
    # pratiğe girer — admin'in kaydettiği SIRAYLA (karıştırma yok).
    pool = [
        {"id": p["id"], "fen": p["fen"], "candidate_moves": p["candidate_moves"]}
        for p in section.practice_positions
        if p.get("candidate_moves")
    ]
    if not pool:
        raise HTTPException(400, "Havuzda pratik yapılacak pozisyon yok")

    session = ChildAdayHamleSession(
        child_id=child.id, section_id=payload.section_id,
        duration_minutes=payload.duration_minutes, pool_snapshot=pool,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {
        "id": session.id, "duration_minutes": session.duration_minutes,
        "current_index": 0, "total": len(pool),
        "position": _position_payload(pool[0]),
    }


@router.post("/sessions/{session_id}/answer")
async def submit_answer(
    session_id: int, payload: AnswerRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_owned_session(session_id, child, db)
    if session.ended_at is not None:
        raise HTTPException(409, "Oturum zaten bitmiş")
    total = len(session.pool_snapshot)
    if session.current_index >= total:
        raise HTTPException(409, "Havuzdaki tüm pozisyonlar zaten cevaplandı")

    position = session.pool_snapshot[session.current_index]
    # Madde: "hamlelerin sırası farklı olabilir, aynı hamle olması şart" —
    # her tahmin BAĞIMSIZ olarak cevap anahtarı KÜMESİNDE mi diye bakılır.
    answer_uci_set = {c["move_uci"] for c in position["candidate_moves"]}
    results = [move in answer_uci_set for move in payload.moves]

    session.answers = [
        *session.answers,
        {"position_id": position["id"], "student_moves": payload.moves, "results": results},
    ]
    session.current_index += 1
    finished = session.current_index >= total
    if finished:
        session.ended_at = datetime.utcnow()
    await db.commit()

    return {
        "results": results,
        "finished": finished,
        "next_position": (
            None if finished else _position_payload(session.pool_snapshot[session.current_index])
        ),
    }


@router.post("/sessions/{session_id}/finish")
async def finish_session(
    session_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Süre dolunca istemci çağırır — yarım kalan (henüz Kaydet'e basılmamış)
    tahminler kaydedilmez, sadece o ana kadarki cevaplar kalıcılaşır.
    İdempotent: oturum zaten bittiyse no-op."""
    session = await _get_owned_session(session_id, child, db)
    if session.ended_at is None:
        session.ended_at = datetime.utcnow()
        await db.commit()
    return {"ok": True}


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """"Kontrol Et" için tam oturum — pozisyon+cevap anahtarı+sporcunun
    hamleleri sırayla eşleştirilip döner. Frontend normalde bunu oturum
    sırasında zaten client-side biriktirdiği için bu uç asıl olarak sayfa
    yenilense bile veri kaybolmasın diye bir yedek/kalıcılık garantisidir."""
    session = await _get_owned_session(session_id, child, db)
    by_id = {p["id"]: p for p in session.pool_snapshot}
    items = []
    for a in session.answers:
        pos = by_id.get(a["position_id"])
        if not pos:
            continue
        items.append({
            "fen": pos["fen"],
            "candidate_moves": pos["candidate_moves"],
            "student_moves": a["student_moves"],
            "results": a["results"],
        })
    return {
        "id": session.id, "duration_minutes": session.duration_minutes,
        "started_at": session.started_at.isoformat(),
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        "items": items,
    }
