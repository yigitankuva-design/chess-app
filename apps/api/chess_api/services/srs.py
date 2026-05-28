"""Simplified SM-2 spaced repetition.

reps 0 -> next 1 day; 1 -> 3 days; 2 -> 7 days; 3+ -> prev_interval * ease_factor.
Wrong answer: reset reps to 0, interval to 0 (re-show within ~1 hour), reduce ease (floor 1.3).
"""
import enum
from datetime import datetime, timedelta


class SRSResult(str, enum.Enum):
    correct = "correct"
    wrong = "wrong"


EASE_FLOOR = 1.3


def update_card(interval_days: float, ease_factor: float, reps_count: int, result: SRSResult) -> dict:
    """Update SRS card state based on review result.

    Args:
        interval_days: Current interval in days
        ease_factor: Current ease factor (typically 1.3-3.0)
        reps_count: Number of correct repetitions so far
        result: SRSResult.correct or SRSResult.wrong

    Returns:
        dict with updated: interval_days, ease_factor, reps_count, due_at, last_result
    """
    if result == SRSResult.wrong:
        return {
            "interval_days": 0.0,
            "ease_factor": max(EASE_FLOOR, ease_factor - 0.2),
            "reps_count": 0,
            "due_at": datetime.utcnow() + timedelta(hours=1),
            "last_result": "wrong",
        }

    new_reps = reps_count + 1
    if new_reps == 1:
        new_interval = 1.0
    elif new_reps == 2:
        new_interval = 3.0
    elif new_reps == 3:
        new_interval = 7.0
    else:
        new_interval = interval_days * ease_factor

    return {
        "interval_days": new_interval,
        "ease_factor": ease_factor,
        "reps_count": new_reps,
        "due_at": datetime.utcnow() + timedelta(days=new_interval),
        "last_result": "correct",
    }
