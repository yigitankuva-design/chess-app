"""Sporcu Performans Puanı — Elo benzeri derecelendirme (madde: 2026-08-20,
Lichess/chess.com sistematiğine benzer). Her tempo türü (Yıldırım/Hızlı/
Klasik) İÇİN AYRI hesaplanır — bkz. ChildTempoRating.

Yalnızca "rated=True" insan-insan maçlarda, sonucu belli (mat/pat/terk/
bayrak/beraberlik) ve tempo'su TEMPO_BY_SECONDS'taki 9 sabitten birine tam
eşleşen maçlarda çalışır. Bot maçları asla etkilemez (madde 5).
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import Game, GameType, ChildTempoRating
from chess_api.services.tempo import tempo_category

STARTING_RATING = 400
# Lichess/USCF benzeri iki kademeli K-faktör: yeni sporcu puanı daha hizli
# otursun diye ilk 20 macta yuksek K, sonrasinda daha kararli/dusuk K.
K_PROVISIONAL = 40
K_ESTABLISHED = 20
PROVISIONAL_GAMES = 20

# (alt_sinir, ust_sinir_DAHIL, unvan) — ust_sinir None ise sinirsiz (madde 8).
TITLE_TIERS: list[tuple[int, int | None, str]] = [
    (0, 399, "BD-1"), (400, 599, "BD-2"), (600, 799, "BD-3"), (800, 999, "BD-4"),
    (1000, 1199, "OD-1"), (1200, 1399, "OD-2"), (1400, 1599, "OD-3"),
    (1600, 1799, "İD-1"), (1800, 1999, "İD-2"),
    (2000, 2199, "CM"), (2200, 2399, "NM"), (2400, 2499, "FM"),
    (2500, 2599, "IM"), (2600, 2699, "GM"), (2700, 2799, "SGM"),
    (2800, None, "WEGM"),
]


def title_for_rating(rating: int) -> str:
    for low, high, title in TITLE_TIERS:
        if rating >= low and (high is None or rating <= high):
            return title
    return TITLE_TIERS[0][2]  # rating negatifse (olmamali) en alt unvana duser


async def get_rating_or_default(db: AsyncSession, child_id: int, tempo: str) -> int:
    """SALT OKUNUR goruntuleme icin (game_info, /athletes, siralama vb.) —
    satir yoksa DB'ye HICBIR SEY YAZMADAN varsayilan baslangic puanini doner."""
    row = (await db.execute(
        select(ChildTempoRating).where(
            ChildTempoRating.child_id == child_id, ChildTempoRating.tempo == tempo,
        )
    )).scalar_one_or_none()
    return row.rating if row else STARTING_RATING


async def get_rating_and_title(db: AsyncSession, child_id: int, tempo: str) -> tuple[int, str | None]:
    """Madde 2026-09-10: rating'i VE (varsa) unvanı BİRLİKTE döner — SALT
    OKUNUR görüntüleme için TEK çağrı noktası (game_info, /athletes,
    sıralama vb. artık bunu kullanır, get_rating_or_default + title_for_rating
    ikilisini AYRI AYRI çağırmaz).

    Herkes AYNI sabit puanla (STARTING_RATING) başladığı için, ilk
    PROVISIONAL_GAMES maç bitmeden bir unvan (ör. "OD-1") göstermek
    yanıltıcı olur — bu yüzden provisional dönemde title=None döner (sayı
    henüz kendi seviyesine oturmadı). Hiç kaydı olmayan sporcu da 0 maç
    oynamış sayılır, dolayısıyla provisional'dır."""
    row = (await db.execute(
        select(ChildTempoRating).where(
            ChildTempoRating.child_id == child_id, ChildTempoRating.tempo == tempo,
        )
    )).scalar_one_or_none()
    rating = row.rating if row else STARTING_RATING
    games_played = row.games_played if row else 0
    title = title_for_rating(rating) if games_played >= PROVISIONAL_GAMES else None
    return rating, title


async def get_or_create_rating(db: AsyncSession, child_id: int, tempo: str) -> ChildTempoRating:
    row = (await db.execute(
        select(ChildTempoRating).where(
            ChildTempoRating.child_id == child_id, ChildTempoRating.tempo == tempo,
        )
    )).scalar_one_or_none()
    if row is None:
        row = ChildTempoRating(child_id=child_id, tempo=tempo, rating=STARTING_RATING, games_played=0)
        db.add(row)
        await db.flush()
    return row


def _k_factor(games_played: int) -> int:
    return K_PROVISIONAL if games_played < PROVISIONAL_GAMES else K_ESTABLISHED


async def apply_rating_update(db: AsyncSession, game: Game) -> None:
    """İnsan-insan, 'rated' bir maç bitince (5 finish noktasının HEPSİNDEN
    _on_human_game_finished ile TEK yerden) çağrılır. commit ETMEZ —
    çağıran commit eder (aynı işlemde turnuva puanlamasıyla birlikte)."""
    if (not game.rated or game.type != GameType.human or game.result is None
            or game.white_child_id is None or game.black_child_id is None):
        return
    tempo = tempo_category(game.base_ms, game.increment_ms)
    if tempo is None:
        return  # 9 sabit tempodan birine tam eslemiyor — derecelendirilmez

    white = await get_or_create_rating(db, game.white_child_id, tempo)
    black = await get_or_create_rating(db, game.black_child_id, tempo)

    result_scores = {"1-0": (1.0, 0.0), "0-1": (0.0, 1.0), "1/2-1/2": (0.5, 0.5)}
    score_white, score_black = result_scores[game.result.value]

    expected_white = 1 / (1 + 10 ** ((black.rating - white.rating) / 400))
    expected_black = 1 - expected_white

    k_white = _k_factor(white.games_played)
    k_black = _k_factor(black.games_played)

    white_before, black_before = white.rating, black.rating
    white.rating = max(0, round(white.rating + k_white * (score_white - expected_white)))
    black.rating = max(0, round(black.rating + k_black * (score_black - expected_black)))
    white.games_played += 1
    black.games_played += 1

    # Madde 2026-09-06 (8): "Maçlarımın Analizi" kartındaki puan farkı için
    # bu maça özel anlık görüntü — ChildTempoRating CÜMÜLATİF olduğu için
    # (hep en güncel puanı tutar), geçmiş bir maça bakınca o ANKİ değişimi
    # göstermenin tek yolu bunu maçın kendisine yazmak.
    game.white_rating_before = white_before
    game.white_rating_after = white.rating
    game.black_rating_before = black_before
    game.black_rating_after = black.rating
