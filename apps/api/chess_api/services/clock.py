"""Satranc saati — saf mantik.

Zaman PARAMETRE olarak gelir (now). Boylece testler beklemez ve sunucu saati
tek bir yerden okunur. presence.py ve offer_sides.py ile ayni desen.

Milisaniye kullanilir: artirim ve gecen sure saniyenin altinda birikir.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class ClockState:
    white_ms: int
    black_ms: int
    last_at: float      # epoch saniye
    # Madde 2026-09-XX: TEK paylaşılan artırım yerine TARAF BAŞINA — Berserk
    # yapan tarafın artırımı SIFIRLANIR (sadece süresi yarılanmıyor), rakibi
    # normal artırımını almaya devam eder (bkz. routers/live_game.py::_clock_state).
    white_increment_ms: int
    black_increment_ms: int


def elapsed_ms(last_at: float, now: float) -> int:
    """Gecen sure (ms). Sunucu saati geri giderse 0 — negatif sure olmaz."""
    delta = now - last_at
    return int(delta * 1000) if delta > 0 else 0


def apply_move(state: ClockState, white_to_move: bool, now: float) -> ClockState:
    """Hamleyi YAPANIN saatinden gecen sureyi duser, artirimi ekler.

    Rakibin saatine dokunulmaz. Saat 0'in altina dusmez; 0'a dusen oyuncuya
    artirim da verilmez (sure bitmistir, hamle onu diriltmez).
    """
    spent = elapsed_ms(state.last_at, now)
    if white_to_move:
        left = state.white_ms - spent
        left = 0 if left <= 0 else left + state.white_increment_ms
        return ClockState(left, state.black_ms, now, state.white_increment_ms, state.black_increment_ms)
    left = state.black_ms - spent
    left = 0 if left <= 0 else left + state.black_increment_ms
    return ClockState(state.white_ms, left, now, state.white_increment_ms, state.black_increment_ms)


def is_flagged(state: ClockState, white_to_move: bool, now: float) -> bool:
    """Sirasi gelen oyuncunun suresi bitti mi?

    Hamle BEKLERKEN de dogru cevap verir: son hamleden bu yana gecen sure
    siradaki oyuncunun kalanini astiysa True.
    """
    spent = elapsed_ms(state.last_at, now)
    remaining = state.white_ms if white_to_move else state.black_ms
    return spent >= remaining
