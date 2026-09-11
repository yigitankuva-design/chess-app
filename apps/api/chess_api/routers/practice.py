from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models import ChildProfile, LessonStep
from chess_api.models.practice import ChildPracticeResult, ChildPracticeAttempt, ChildOdevProgress

VALID_MODES = {"suresiz", "sureli", "test"}
# Madde 2026-09-11 (Ödev Sistemi, Faz 1): "suresiz" (Ödevini Yap) artık
# batch /submit ile DEĞİL, soru soru /odev/answer ile kaydedilir. /submit
# hâlâ sureli + test için geçerli.
SUBMIT_MODES = {"sureli", "test"}

# Madde 2026-09-05: mod -> content_json'daki soru havuzu alanı. Frontend'deki
# lib/practice/unlock.ts PRACTICE_MODE_FIELDS ile AYNI eşleme (tek kaynak
# iki tarafta ayrı ayrı tutuluyor — admin/lessons.py'de de aynı desen var).
MODE_FIELDS = {
    "suresiz": "board_exercises",
    "sureli": "board_exercises_timed",
    "test": "board_exercises_test",
}
DEFAULT_QUESTION_COUNT = 20

router = APIRouter(prefix="/practice", tags=["practice"])


class SubmitRequest(BaseModel):
    mode: str
    correct: int = Field(ge=0)
    total: int = Field(gt=0)
    # Madde 2026-09-05: Sporcu Profili "Ödevlerim" paneli için — bu denemede
    # HER sorunun (havuzdaki/ekrandaki sırayla) doğru mu yanlış mı olduğu.
    # Opsiyonel: eski istemciler (veya bu alanı henüz göndermeyenler) None
    # gönderebilir, best_correct/best_total yine de güncellenir.
    per_question: list[bool] | None = None


class SubmitResponse(BaseModel):
    score: int
    best_score: int
    improved: bool


class DetailResponse(BaseModel):
    best_score: int
    best_correct: int
    best_total: int
    attempts_count: int
    # Madde 2026-09-05: bkz. SubmitRequest.per_question — en iyi denemeye ait.
    # Madde 2026-09-11: "suresiz" için BİRİKİMLİ ilk-çözüm durumu — henüz
    # cevaplanmamış sorular None kalır (kısmi ilerleme gösterilir).
    per_question_correct: list[bool | None] | None = None
    # Bu alt konu + modun ŞU ANKİ soru sayısı (deneme olsun olmasın) — havuz
    # admin'de büyüdükçe/küçüldükçe güncel kalır; "Ödevlerim" kare sayısı
    # bundan gelir (best_total'a değil — hiç denenmemişse best_total sıfırdır).
    pool_size: int = 0
    # Madde 2026-09-11 (Ödev Sistemi, Faz 1) — SADECE "suresiz" için anlamlı:
    completed: bool = False       # N sorunun hepsi cevaplandı mı (ödev bitti mi)
    answered_count: int = 0       # kaç soru cevaplandı (birikimli)


def _pool_size(step: LessonStep, mode: str) -> int:
    """Bu alt konu + modun ŞU AN kaç soru göstereceği — pratik ekranındaki
    `resolvedPick` mantığıyla AYNI (apps/web/app/(child)/pratik/[mode]/page.tsx):
    admin'in girdiği question_counts varsa o, yoksa DEFAULT_QUESTION_COUNT;
    havuz bundan azsa havuzun tamamı gösterilir."""
    field = MODE_FIELDS.get(mode)
    if field is None:
        return 0
    content = step.content_json or {}
    pool = content.get(field) or []
    counts = content.get("question_counts") or {}
    configured = counts.get(field)
    resolved = configured if isinstance(configured, int) and configured > 0 else DEFAULT_QUESTION_COUNT
    return min(resolved, len(pool))


def _odev_set_size(step: LessonStep) -> int:
    """Madde 2026-09-11 (Ödev Sistemi, Faz 1): "Ödevini Yap"ta sporcunun
    çözmesi GEREKEN sabit soru sayısı N — admin'in `question_counts.
    board_exercises` değeri (girmişse), yoksa havuzun TAMAMI. Herkeste
    aynı N, havuz sırasına göre (rastgele YOK)."""
    content = step.content_json or {}
    pool = content.get("board_exercises") or []
    counts = content.get("question_counts") or {}
    configured = counts.get("board_exercises")
    if isinstance(configured, int) and configured > 0:
        return min(configured, len(pool))
    return len(pool)


async def _get_odev_row(db: AsyncSession, child_id: int, step_id: int) -> ChildOdevProgress | None:
    q = select(ChildOdevProgress).where(
        ChildOdevProgress.child_id == child_id,
        ChildOdevProgress.lesson_step_id == step_id,
    )
    return (await db.execute(q)).scalar_one_or_none()


def _odev_completed(answered_map: dict, n: int) -> bool:
    """N sorunun HEPSİ (havuz index 0..N-1) en az bir kez cevaplandı mı."""
    if n <= 0:
        return False
    return all(str(i) in (answered_map or {}) for i in range(n))


async def _get_row(db: AsyncSession, child_id: int, step_id: int, mode: str):
    q = select(ChildPracticeResult).where(
        ChildPracticeResult.child_id == child_id,
        ChildPracticeResult.lesson_step_id == step_id,
        ChildPracticeResult.mode == mode,
    )
    return (await db.execute(q)).scalar_one_or_none()


@router.post("/steps/{step_id}/submit", response_model=SubmitResponse)
async def submit_practice(
    step_id: int,
    payload: SubmitRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Bir pratik oturumunun sonucunu kaydeder ve en iyi skoru günceller.

    Puan İSTEMCİDEN ALINMAZ, burada hesaplanır — istemciye güvenilmez.

    Madde 2026-09-11 (Ödev Sistemi, Faz 1): SADECE sureli + test. "suresiz"
    (Ödevini Yap) artık soru soru POST /practice/steps/{id}/odev/answer ile
    kaydedilir (birikimli, eşiksiz).
    """
    if payload.mode not in SUBMIT_MODES:
        raise HTTPException(
            status_code=400,
            detail="Invalid mode (suresiz artık /odev/answer kullanır)",
        )
    if payload.correct > payload.total:
        raise HTTPException(status_code=400, detail="correct cannot exceed total")
    if payload.per_question is not None and len(payload.per_question) != payload.total:
        raise HTTPException(status_code=400, detail="per_question length must equal total")

    step = await db.get(LessonStep, step_id)
    if step is None:
        raise HTTPException(status_code=404, detail="Lesson step not found")

    score = round(payload.correct / payload.total * 100)
    row = await _get_row(db, child.id, step_id, payload.mode)

    if row is None:
        row = ChildPracticeResult(
            child_id=child.id, lesson_step_id=step_id, mode=payload.mode,
            best_score=score, best_correct=payload.correct, best_total=payload.total,
            per_question_correct=payload.per_question,
            attempts_count=1, last_played_at=datetime.utcnow(),
        )
        db.add(row)
        improved = True
    else:
        row.attempts_count += 1
        row.last_played_at = datetime.utcnow()
        improved = score > row.best_score
        if improved:
            row.best_score = score
            row.best_correct = payload.correct
            row.best_total = payload.total
            row.per_question_correct = payload.per_question

    # Madde 2026-09-06 (Görsel 6/7): ChildPracticeResult (en iyi deneme)
    # AYRICA, bu denemenin kendisi de TAM GEÇMİŞ olarak child_practice_attempts'e
    # eklenir — Süreli Pratik Yap'ın günlük/haftalık/aylık/yıllık istatistiği ve
    # Kendini Test Et'in "Sınav-N" sekmeleri buradan gelir. best_* güncellemesini
    # ETKİLEMEZ, ayrı bir kayıt.
    prev_attempts = await db.scalar(
        select(func.count(ChildPracticeAttempt.id)).where(
            ChildPracticeAttempt.child_id == child.id,
            ChildPracticeAttempt.lesson_step_id == step_id,
            ChildPracticeAttempt.mode == payload.mode,
        )
    )
    db.add(ChildPracticeAttempt(
        child_id=child.id, lesson_step_id=step_id, mode=payload.mode,
        attempt_no=(prev_attempts or 0) + 1,
        correct_count=payload.correct, total_count=payload.total,
        per_question_correct=payload.per_question,
        created_at=datetime.utcnow(),
    ))

    await db.commit()
    return SubmitResponse(score=score, best_score=row.best_score, improved=improved)


# ─────────────────────────────────────────────────────────────────────────
# Madde 2026-09-11 (Ödev Sistemi, Faz 1): "Ödevini Yap" (suresiz) — soru
# soru, BİRİKİMLİ kayıt. Eşik YOK; N sorunun hepsi cevaplanınca tamamlanır.
# ─────────────────────────────────────────────────────────────────────────

class OdevAnswerRequest(BaseModel):
    # Havuzdaki (admin sırasına göre) sorunun index'i — 0'dan başlar.
    question_index: int = Field(ge=0)
    correct: bool


class OdevProgressResponse(BaseModel):
    total: int                       # çözülmesi gereken sabit soru sayısı N
    answered_count: int              # kaç soru cevaplandı (birikimli)
    correct_count: int
    completed: bool                  # N sorunun hepsi cevaplandı mı
    # Uzunluk N; henüz cevaplanmamış sorular None.
    per_question_correct: list[bool | None]


def _odev_progress_payload(step: LessonStep, row: ChildOdevProgress | None) -> OdevProgressResponse:
    n = _odev_set_size(step)
    amap = (row.answered_map if row else {}) or {}
    per_q: list[bool | None] = [amap.get(str(i)) for i in range(n)]
    answered = [v for v in per_q if v is not None]
    return OdevProgressResponse(
        total=n,
        answered_count=len(answered),
        correct_count=sum(1 for v in answered if v),
        completed=(row.completed_at is not None) if row else _odev_completed(amap, n),
        per_question_correct=per_q,
    )


@router.post("/steps/{step_id}/odev/answer", response_model=OdevProgressResponse)
async def odev_answer(
    step_id: int,
    payload: OdevAnswerRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Bir "Ödevini Yap" sorusunun cevabını (doğru/yanlış) BİRİKİMLİ kaydeder.

    Ödev ZATEN tamamlanmışsa (completed_at dolu) hiçbir şey yazılmaz — sonraki
    TEKRAR çözümler istatistiğe girmez (Zafer'in kararı). Sadece ilk çözüm sayılır.

    Madde 2026-09-11 (Görsel Turu Aşama D / Madde 7): bu kural HOMEWORK'ÜN
    TAMAMI bitmeden ÖNCE de, SORU BAZINDA geçerli — bir soru bir kez
    cevaplandıysa (`str(index) in amap`), ödev henüz tamamlanmamış olsa
    BİLE üzerine yazılmaz. Normal "Ödevini Yap" akışında zaten hiçbir
    zaman aynı index'e ikinci kez gelinmez (sadece ileri gider — bkz.
    pratik/[mode]/page.tsx), ama yeni "İnceleme" modu (sporcu/antrenör
    yanlış cevaplanan bir karta tıklayıp o soruyu tekrar çözebiliyor)
    hiç kayıt göndermese de, bu satır API katmanında ikinci bir güvence.
    """
    step = await db.get(LessonStep, step_id)
    if step is None:
        raise HTTPException(status_code=404, detail="Lesson step not found")
    n = _odev_set_size(step)

    row = await _get_odev_row(db, child.id, step_id)
    if row is not None and row.completed_at is not None:
        return _odev_progress_payload(step, row)  # ödev bitti — tekrar çözüm sayılmaz

    if payload.question_index >= max(n, 1):
        raise HTTPException(status_code=400, detail="question_index out of range")

    if row is not None and str(payload.question_index) in (row.answered_map or {}):
        return _odev_progress_payload(step, row)  # bu soru DAHA ÖNCE cevaplandı — sabit kalır

    if row is None:
        row = ChildOdevProgress(
            child_id=child.id, lesson_step_id=step_id, answered_map={},
        )
        db.add(row)

    amap = dict(row.answered_map or {})
    amap[str(payload.question_index)] = payload.correct
    row.answered_map = amap
    row.updated_at = datetime.utcnow()
    if row.completed_at is None and _odev_completed(amap, n):
        row.completed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(row)
    return _odev_progress_payload(step, row)


@router.get("/steps/{step_id}/odev/progress", response_model=OdevProgressResponse)
async def odev_progress(
    step_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Bu çocuğun bu alt konudaki "Ödevini Yap" birikimli ilerlemesi —
    pratik ekranı bunu çekip kaldığı yerden devam ettirir."""
    step = await db.get(LessonStep, step_id)
    if step is None:
        raise HTTPException(status_code=404, detail="Lesson step not found")
    return _odev_progress_payload(step, await _get_odev_row(db, child.id, step_id))


async def _compute_practice_detail(child_id: int, step_id: int, mode: str, db: AsyncSession) -> DetailResponse:
    """`practice_detail`'ın gövdesi — madde 2026-09-07 (GRUP B): antrenörün
    salt-okunur öğrenci-profili uçları (teacher.py) da AYNI mantığı
    kullanır diye ayrı bir fonksiyona çıkarıldı. Davranış DEĞİŞMEDİ
    (KURAL #3).

    pool_size HER ZAMAN hesaplanır (kayıt olsun olmasın) — madde 2026-09-05:
    Sporcu Profili "Ödevlerim" paneli hiç denenmemiş bir alt konuda bile
    kaç soru olduğunu (gri kare sayısı) bilmek zorunda."""
    if mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail="Invalid mode")
    step = await db.get(LessonStep, step_id)
    if step is None:
        raise HTTPException(status_code=404, detail="Lesson step not found")

    # Madde 2026-09-11: "suresiz" (Ödevini Yap) artık BİRİKİMLİ ilk-çözüm
    # durumundan okunur (ChildOdevProgress) — best_score, "tamamlandı mı"nın
    # 100/0 vekilidir (Ders İlerlemesi kartı + kilit için).
    if mode == "suresiz":
        n = _odev_set_size(step)
        p = _odev_progress_payload(step, await _get_odev_row(db, child_id, step_id))
        return DetailResponse(
            best_score=100 if p.completed else (round(p.correct_count / n * 100) if n else 0),
            best_correct=p.correct_count, best_total=n,
            attempts_count=1 if p.answered_count > 0 else 0,
            per_question_correct=p.per_question_correct if p.answered_count > 0 else None,
            pool_size=n, completed=p.completed, answered_count=p.answered_count,
        )

    pool_size = _pool_size(step, mode)
    row = await _get_row(db, child_id, step_id, mode)
    if row is None:
        return DetailResponse(best_score=0, best_correct=0, best_total=0, attempts_count=0, pool_size=pool_size)
    return DetailResponse(
        best_score=row.best_score, best_correct=row.best_correct,
        best_total=row.best_total, attempts_count=row.attempts_count,
        per_question_correct=row.per_question_correct, pool_size=pool_size,
    )


@router.get("/steps/{step_id}/detail", response_model=DetailResponse)
async def practice_detail(
    step_id: int,
    mode: str = "suresiz",
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Tek bir alt konu+mod için en iyi sonuç. Kayıt yoksa sıfırlarla döner."""
    return await _compute_practice_detail(child.id, step_id, mode, db)


class PeriodStat(BaseModel):
    total: int
    correct: int
    wrong: int
    success_rate: int  # 0..100, hiç deneme yoksa 0


def _period_stat(rows: list[ChildPracticeAttempt]) -> PeriodStat:
    total = sum(r.total_count for r in rows)
    correct = sum(r.correct_count for r in rows)
    rate = round(correct / total * 100) if total > 0 else 0
    return PeriodStat(total=total, correct=correct, wrong=total - correct, success_rate=rate)


class AttemptsSummaryResponse(BaseModel):
    daily: PeriodStat
    weekly: PeriodStat
    monthly: PeriodStat
    yearly: PeriodStat


async def _compute_attempts_summary(child_id: int, step_id: int, mode: str, db: AsyncSession) -> AttemptsSummaryResponse:
    """`attempts_summary`'nin gövdesi — madde 2026-09-07 (GRUP B): antrenörün
    salt-okunur öğrenci-profili uçları (teacher.py) da AYNI mantığı
    kullanır diye ayrı bir fonksiyona çıkarıldı. Davranış DEĞİŞMEDİ
    (KURAL #3)."""
    if mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail="Invalid mode")
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)
    year_start = today_start.replace(month=1, day=1)

    rows = (await db.execute(
        select(ChildPracticeAttempt).where(
            ChildPracticeAttempt.child_id == child_id,
            ChildPracticeAttempt.lesson_step_id == step_id,
            ChildPracticeAttempt.mode == mode,
        )
    )).scalars().all()

    return AttemptsSummaryResponse(
        daily=_period_stat([r for r in rows if r.created_at >= today_start]),
        weekly=_period_stat([r for r in rows if r.created_at >= week_start]),
        monthly=_period_stat([r for r in rows if r.created_at >= month_start]),
        yearly=_period_stat([r for r in rows if r.created_at >= year_start]),
    )


@router.get("/steps/{step_id}/attempts-summary", response_model=AttemptsSummaryResponse)
async def attempts_summary(
    step_id: int,
    mode: str = "sureli",
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-06 (Görsel 6): "Süreli Pratik Yap" için günlük/haftalık/
    aylık/yıllık istatistik — TAKVİM dönemleri (bugün / bu hafta Pzt-Paz /
    bu ay / bu yıl), madde 4'teki "aynı hafta günü" mantığından FARKLI (o
    sadece "Bu Hafta" kartına özel — burada Zafer'in görseli standart
    dönemleri gösteriyor)."""
    return await _compute_attempts_summary(child.id, step_id, mode, db)


class AttemptRow(BaseModel):
    attempt_no: int
    correct_count: int
    total_count: int
    per_question_correct: list[bool] | None = None


class AttemptsResponse(BaseModel):
    attempts: list[AttemptRow]


async def _compute_attempts(child_id: int, step_id: int, mode: str, db: AsyncSession) -> AttemptsResponse:
    """`list_attempts`'ın gövdesi — madde 2026-09-07 (GRUP B): antrenörün
    salt-okunur öğrenci-profili uçları (teacher.py) da AYNI mantığı
    kullanır diye ayrı bir fonksiyona çıkarıldı. Davranış DEĞİŞMEDİ
    (KURAL #3)."""
    if mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail="Invalid mode")
    rows = (await db.execute(
        select(ChildPracticeAttempt).where(
            ChildPracticeAttempt.child_id == child_id,
            ChildPracticeAttempt.lesson_step_id == step_id,
            ChildPracticeAttempt.mode == mode,
        ).order_by(ChildPracticeAttempt.attempt_no)
    )).scalars().all()
    return AttemptsResponse(attempts=[
        AttemptRow(
            attempt_no=r.attempt_no, correct_count=r.correct_count,
            total_count=r.total_count, per_question_correct=r.per_question_correct,
        ) for r in rows
    ])


@router.get("/steps/{step_id}/attempts", response_model=AttemptsResponse)
async def list_attempts(
    step_id: int,
    mode: str = "test",
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-06 (Görsel 7): "Kendini Test Et" — bu alt konudaki TÜM
    denemeler, attempt_no sırasıyla ("Sınav-1", "Sınav-2", ...). Sporcu
    geçtiği anda zincirdeki bir sonraki alt konu açılır (unlock.ts) — yeni
    "Sınav-N+1" deneme sporcu tekrar oynamadıkça KENDİLİĞİNDEN oluşmaz."""
    return await _compute_attempts(child.id, step_id, mode, db)


class ScoreRow(BaseModel):
    step_id: int
    mode: str
    best_score: int


class ScoresResponse(BaseModel):
    scores: list[ScoreRow]


async def _compute_lesson_scores(child_id: int, lesson_id: int, db: AsyncSession) -> ScoresResponse:
    """`lesson_scores`'un gövdesi — madde 2026-09-07 (GRUP B): antrenörün
    salt-okunur öğrenci-profili uçları (teacher.py) da AYNI mantığı
    kullanır diye ayrı bir fonksiyona çıkarıldı.

    Madde 2026-09-11 (Ödev Sistemi, Faz 1): "suresiz" (Ödevini Yap) satırları
    artık ChildPracticeResult'tan DEĞİL, ChildOdevProgress'ten üretilir —
    best_score, "ödev tamamlandı mı"nın 100/0 VEKİLİdir. Böylece unlock.ts'in
    `bestScore(suresiz) >= threshold` kontrolü DEĞİŞMEDEN çalışır (100 >= herhangi
    bir eşik → Süreli Pratik Yap açılır; 0 → kilitli). sureli/test aynen kalır."""
    q = (
        select(ChildPracticeResult)
        .join(LessonStep, ChildPracticeResult.lesson_step_id == LessonStep.id)
        .where(
            LessonStep.lesson_id == lesson_id,
            ChildPracticeResult.child_id == child_id,
            ChildPracticeResult.mode != "suresiz",  # suresiz artık odev_progress'ten
        )
    )
    rows = (await db.execute(q)).scalars().all()
    scores = [
        ScoreRow(step_id=r.lesson_step_id, mode=r.mode, best_score=r.best_score)
        for r in rows
    ]

    odev_rows = (await db.execute(
        select(ChildOdevProgress, LessonStep)
        .join(LessonStep, ChildOdevProgress.lesson_step_id == LessonStep.id)
        .where(
            LessonStep.lesson_id == lesson_id,
            ChildOdevProgress.child_id == child_id,
        )
    )).all()
    for prog, step in odev_rows:
        done = prog.completed_at is not None or _odev_completed(prog.answered_map or {}, _odev_set_size(step))
        scores.append(ScoreRow(step_id=prog.lesson_step_id, mode="suresiz", best_score=100 if done else 0))

    return ScoresResponse(scores=scores)


@router.get("/lessons/{lesson_id}/scores", response_model=ScoresResponse)
async def lesson_scores(
    lesson_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Bu çocuğun, bu dersin tüm alt konularındaki en iyi skorları.

    Frontend bunu ScoreMap'e çevirip kilitleri hesaplar (bkz. lib/practice/unlock.ts).
    """
    return await _compute_lesson_scores(child.id, lesson_id, db)
