"""İsviçre usulü turnuva motoru — Arena'nın YANINDA ikinci bir mod
(madde 2026-09-10). Bu oturumun başında Arena'ya geçilirken tamamen
kaldırılmıştı (bkz. migration TournamentArena) — şimdi Zafer'in isteğiyle
İKİNCİ bir seçenek olarak geri geliyor, Arena SİLİNMİYOR.

Basitleştirilmiş İsviçre — bilinçli kapsam dışı bırakılanlar: tam FIDE/Dutch-
sistemi (floater kuralları, gelişmiş renk dengesi tam skoru) YOK. Ama madde
2026-09-XX'te Zafer'in netleştirdiği İKİ kural KESİN (hard constraint):
- İki sporcu bir turnuvada KESİNLİKLE ikinci kez eşleşmez (rematch YOK,
  eskiden "küçük turnuvalarda tekrara izin verilir" istisnası VARDI —
  artık YOK, bkz. _match_avoiding_rematches — geri izleme/backtracking
  ile ARANIR, sadece en yakın puanlıya bakıp pes edilmez).
- Bir sporcu KESİNLİKLE 3 maç üst üste aynı renkle oynamaz (bkz.
  _forced_color/_assign_colors) — bu "best effort hard": ikisi de aynı
  renge zorlanan iki oyuncu birbirine denk gelirse (nadir çakışma) biri
  serisini bozar (dokümante edildi, gerçek FIDE Dutch bunu da tam çözer
  ama o seviyedeki karmaşıklık bilinçli kapsam dışı).

Tur geçişi OTOMATİK ve LAZY — services/tournaments.py::sync_tournament_status
ile AYNI mimari desen (arka planda cron/scheduler YOK, her çağıran bunu
tetikler). Bu dosya `create_game` callback'i ALIR (routers/live_game.py'deki
_create_human_game'i SARAR) — services routers'a bağımlı OLMASIN diye
(arena_matchmaking.find_arena_opponent'taki AYNI bağımlılık-tersine-çevirme
deseni).
"""
import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Awaitable, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from chess_api.models import Tournament, TournamentParticipant, TournamentPairing, TournamentStatus
from chess_api.services.tournaments import _apply_swiss_bye_points

CreateGame = Callable[[int, int], Awaitable[int]]


@dataclass
class RoundPairing:
    white_child_id: int
    black_child_id: int


def _match_avoiding_rematches(
    remaining: list[TournamentParticipant], played: dict[int, set[int]],
) -> list[tuple[TournamentParticipant, TournamentParticipant]] | None:
    """Geri izlemeli (backtracking) eşleştirme — `remaining` PUANA GÖRE
    AZALAN sırada gelir. En üstteki kişiyi, oynamadığı en yakın puanlı
    adayla eşlemeyi DENER; bu seçim daha sonra bir çıkmaza (kalanları
    tekrarsız eşleyecek yol kalmaması) yol açarsa bir SONRAKİ adayı dener
    (geri izler). Katılımcı sayıları küçük olduğundan (çocuk akademisi
    turnuvaları) bu her zaman hızlı çalışır.

    Geçerli bir eşleştirme bulunamazsa None döner — çağıran bunu SADECE
    matematiksel olarak imkânsız olduğu (gerçekleşmesi beklenmeyen, ör.
    tur sayısı katılımcı sayısına göre otomatik hesaplandığı için normalde
    hiç tetiklenmeyen) çok nadir bir durumda bir kerelik istisna (tekrara
    izin vererek) çözer — bkz. generate_round_pairings."""
    if not remaining:
        return []
    top = remaining[0]
    rest = remaining[1:]
    for i, cand in enumerate(rest):
        if cand.child_id in played.get(top.child_id, set()):
            continue
        result = _match_avoiding_rematches(rest[:i] + rest[i + 1:], played)
        if result is not None:
            return [(top, cand)] + result
    return None


def _recent_colors(child_id: int, past_pairings: list[TournamentPairing]) -> list[str]:
    """En son oynanan turdan en eskiye doğru renk listesi ('white'/'black').
    Bay aldığı turlar (o kişi için TournamentPairing satırı hiç olmaz) bu
    listede yer almaz — basitleştirme: sadece GERÇEK renkler sayılır, bay
    bir rengi 'kesmez'."""
    rows = sorted(
        (p for p in past_pairings if p.white_child_id == child_id or p.black_child_id == child_id),
        key=lambda p: p.round_number or 0, reverse=True,
    )
    return ["white" if p.white_child_id == child_id else "black" for p in rows]


def _forced_color(child_id: int, past_pairings: list[TournamentPairing]) -> str | None:
    """Son 2 turda AYNI renkse, 3.'yü ENGELLEMEK için zorunlu renk döner —
    madde 2026-09-XX: 'kesinlikle 3 maç üst üste aynı renk YOK'."""
    colors = _recent_colors(child_id, past_pairings)
    if len(colors) >= 2 and colors[0] == colors[1]:
        return "black" if colors[0] == "white" else "white"
    return None


def _assign_colors(
    a: TournamentParticipant, b: TournamentParticipant, past_pairings: list[TournamentPairing],
) -> tuple[TournamentParticipant, TournamentParticipant]:
    """(beyaz, siyah) döner. Öncelik: 3-üst-üste-aynı-renk YASAĞI (zorunlu
    taraf varsa ona uyulur; ikisi de AYNI renge zorlanıyorsa — nadir bir
    çakışma — a'nın zorunlu rengi kazanır, b'nin serisi bu turda bozulur,
    dokümante edilmiş bilinçli basitleştirme). Zorunluluk yoksa en son
    rengin TERSİNE alterne edilir (varsa), o da yoksa rastgele."""
    a_forced = _forced_color(a.child_id, past_pairings)
    b_forced = _forced_color(b.child_id, past_pairings)
    if a_forced:
        return (a, b) if a_forced == "white" else (b, a)
    if b_forced:
        return (b, a) if b_forced == "white" else (a, b)
    a_last = _recent_colors(a.child_id, past_pairings)
    if a_last:
        return (b, a) if a_last[0] == "white" else (a, b)
    b_last = _recent_colors(b.child_id, past_pairings)
    if b_last:
        return (a, b) if b_last[0] == "white" else (b, a)
    return (a, b) if random.random() < 0.5 else (b, a)


def generate_round_pairings(
    participants: list[TournamentParticipant],
    past_pairings: list[TournamentPairing],
) -> tuple[list[RoundPairing], int | None]:
    """Saf fonksiyon — DB'ye dokunmaz. `participants` GÖRÜNÜM listesi olmalı
    (left_at dolu olanlar çağıran tarafından zaten elenmiş olmalı).

    Tek sayıda katılımcı varsa: en AZ bay almış (bye_count), onlar arasında
    en DÜŞÜK puanlı bay alır (gerçek İsviçre pratiğiyle tutarlı — bay en
    zayıfa verilir). Kalanlar puana göre azalan sırada, KESİNLİKLE daha önce
    OYNAMAMIŞ biriyle eşleştirilir (madde 2026-09-XX — geri izlemeli arama,
    bkz. _match_avoiding_rematches; tekrara ASLA izin verilmez, matematiksel
    olarak imkânsız olan çok nadir bir çıkmaz hariç). Renk ataması 3-üst-
    üste-aynı-renk yasağını gözetir (bkz. _assign_colors).
    """
    played: dict[int, set[int]] = {}
    for p in past_pairings:
        played.setdefault(p.white_child_id, set()).add(p.black_child_id)
        played.setdefault(p.black_child_id, set()).add(p.white_child_id)

    pool = list(participants)
    bye_child_id: int | None = None
    if len(pool) % 2 == 1:
        bye_candidate = min(pool, key=lambda p: (p.bye_count, p.score, p.child_id))
        pool.remove(bye_candidate)
        bye_child_id = bye_candidate.child_id

    remaining = sorted(pool, key=lambda p: (-p.score, p.child_id))
    matches = _match_avoiding_rematches(remaining, played)
    if matches is None:
        # Nadir çıkmaz (bkz. _match_avoiding_rematches docstring) — tekrara
        # izin vererek en yakın puanlıyla eşleştir (tek istisna, dokümante).
        matches = []
        pool2 = list(remaining)
        while pool2:
            top = pool2.pop(0)
            opp = pool2.pop(0) if pool2 else None
            if opp is not None:
                matches.append((top, opp))

    pairings = [RoundPairing(*(p.child_id for p in _assign_colors(a, b, past_pairings))) for a, b in matches]
    return pairings, bye_child_id


def compute_rounds_total(participant_count: int) -> int:
    """Madde 2026-09-XX: sporcu artık tur sayısını SEÇMİYOR — 1. tur
    üretilirken (katılım kapanınca) o anki katılımcı sayısına göre otomatik
    hesaplanır. Standart İsviçre kuralı: yukarı yuvarlanmış log2(katılımcı
    sayısı) — 3-4 kişi→2 tur, 5-8 kişi→3 tur, 9-16 kişi→4 tur, vb."""
    return max(1, math.ceil(math.log2(max(participant_count, 1))))


async def _start_round(
    db: AsyncSession, tournament: Tournament, round_number: int, create_game: CreateGame,
) -> None:
    participants = (await db.execute(select(TournamentParticipant).where(
        TournamentParticipant.tournament_id == tournament.id,
        TournamentParticipant.left_at.is_(None),
    ))).scalars().all()
    past_pairings = (await db.execute(select(TournamentPairing).where(
        TournamentPairing.tournament_id == tournament.id,
    ))).scalars().all()

    if tournament.status == TournamentStatus.upcoming:
        tournament.status = TournamentStatus.active
        tournament.started_at = tournament.starts_at
    tournament.current_round = round_number

    if not participants:
        # Kimse katılmamış/hepsi çekilmiş — turnuva anlamsızca asılı kalmasın.
        tournament.status = TournamentStatus.finished
        tournament.finished_at = datetime.utcnow()
        await db.commit()
        return

    if tournament.rounds_total is None:
        # Madde 2026-09-XX: katılım burada (1. tur üretilirken) kapandığı
        # için katılımcı sayısı artık KESİN — tur sayısı şimdi hesaplanıp
        # dondurulur (sonraki turlarda bir daha DEĞİŞMEZ, guard is None).
        tournament.rounds_total = compute_rounds_total(len(participants))

    pairings, bye_child_id = generate_round_pairings(participants, past_pairings)

    if bye_child_id is not None:
        # Madde 2026-09-XX (rapordaki 6. öneri): bay iki farklı değer alır —
        # turnuva BAŞLAMADAN katılmış birine 1.0 TAM puan (gerçek bir
        # galibiyetle AYNI), turnuva başladıktan SONRA katılan (geç katılım
        # artık açık, bkz. routers/tournaments.py::join_tournament, late_
        # joiner bayrağını KATILDIĞI ANDA yazar) birine istismarı önlemek
        # için 0.5 YARIM puan.
        bye_p = next(p for p in participants if p.child_id == bye_child_id)
        _apply_swiss_bye_points(bye_p, 0.5 if bye_p.late_joiner else 1.0)
        bye_p.bye_count += 1

    for pr in pairings:
        game_id = await create_game(pr.white_child_id, pr.black_child_id)
        db.add(TournamentPairing(
            tournament_id=tournament.id,
            white_child_id=pr.white_child_id, black_child_id=pr.black_child_id,
            game_id=game_id, round_number=round_number,
        ))
    await db.commit()


async def advance_swiss_tournament(
    db: AsyncSession, tournament: Tournament, create_game: CreateGame,
) -> None:
    """Lazy — services/tournaments.py::sync_tournament_status ile AYNI
    "her çağıran tetikler" mimarisi. Turnuva HENÜZ başlamadıysa VE zamanı
    geldiyse 1. turu üretir; aktifse VE o turdaki TÜM eşleşmeler
    sonuçlandıysa (result dolu veya "void") ya bir sonraki turu üretir ya
    da (son turdaysa) turnuvayı bitirir.

    Madde 2026-09-XX ("Tur Arası Süre"): bir tur bitince sıradaki tur ARTIK
    ANINDA üretilmiyor — kurucunun seçtiği kadar (round_gap_minutes) beklenir.
    round_ready_at, turun TÜM eşleşmelerinin sonuçlandığı İLK anı tutar (bu
    fonksiyon her çağrıldığında yeniden hesaplanmaz, sadece henüz set
    edilmemişse yazılır) — bekleme bu andan itibaren sayılır. round_gap_
    minutes NULL/0 olan (eski) turnuvalarda eskisi gibi anında geçilir."""
    if tournament.status == TournamentStatus.upcoming:
        if datetime.utcnow() >= tournament.starts_at:
            await _start_round(db, tournament, round_number=1, create_game=create_game)
        return
    if tournament.status != TournamentStatus.active:
        return

    pairings_this_round = (await db.execute(select(TournamentPairing).where(
        TournamentPairing.tournament_id == tournament.id,
        TournamentPairing.round_number == tournament.current_round,
    ))).scalars().all()
    if any(p.result is None for p in pairings_this_round):
        return  # tur hâlâ sürüyor

    if (tournament.rounds_total or 0) <= (tournament.current_round or 0):
        tournament.status = TournamentStatus.finished
        tournament.finished_at = datetime.utcnow()
        await db.commit()
        return

    gap_minutes = tournament.round_gap_minutes or 0
    if gap_minutes > 0:
        if tournament.round_ready_at is None:
            tournament.round_ready_at = datetime.utcnow()
            await db.commit()
            return  # bekleme süresi şimdi başladı
        if datetime.utcnow() - tournament.round_ready_at < timedelta(minutes=gap_minutes):
            return  # hâlâ bekleniyor

    tournament.round_ready_at = None  # sıradaki turun kendi bekleme süresi için sıfırla
    await _start_round(db, tournament, round_number=(tournament.current_round or 0) + 1, create_game=create_game)
