"""Build the `raw` dataset (the shape consumed by web-src/src/data.js) from a
real Anki collection.

`raw` contract (mirror of data.js):
  { today, decks:[{name,retain}], days:[{date,dow,studied,reviews,newC,learning,
    relearning,total,timeSec,again,hard,good,easy,retention,deckSplit,mature}],
    hourly, forecast, fsrs, records, achievements }

Each section is computed defensively — a failure in one (e.g. an unusual FSRS
state) degrades that section rather than taking down the whole window.
"""
from __future__ import annotations

import datetime
from typing import Any, Dict, List

DAY_SEC = 86400
N_DAYS = 365 * 3 + 30  # ~3 years of daily history for the trend/calendar

# revlog.type: 0 learn · 1 review · 2 relearn · 3 filtered/cram · 4 manual (no answer)
REVLOG_STUDY_TYPES = (0, 1, 2, 3)
# FSRS forgetting curve (FSRS-5 default). Good approximation for the recall bands.
_FSRS_DECAY = -0.5


def _power_forgetting_curve(t: float, s: float, decay: float = _FSRS_DECAY) -> float:
    if s <= 0:
        return 0.0
    factor = 0.9 ** (1.0 / decay) - 1.0
    r = (1.0 + factor * t / s) ** decay
    return max(0.0, min(1.0, r))


# ---------------------------------------------------------------- helpers
def _civil_utc_midnight_ms(end_sec: int) -> int:
    """Given the end-of-Anki-day timestamp, return UTC-midnight ms of that day's
    civil (local) date — so JS `toLocaleDateString(timeZone:'UTC')` shows the
    correct calendar day regardless of the user's zone."""
    civ = datetime.datetime.fromtimestamp(end_sec - 1)
    return int(datetime.datetime(civ.year, civ.month, civ.day, tzinfo=datetime.timezone.utc).timestamp() * 1000)


def _top_deck(name: str) -> str:
    return name.split("::", 1)[0] if name else "Default"


def _fmt_dur(sec: int) -> str:
    h, m = sec // 3600, round((sec % 3600) / 60)
    return f"{h}h {m:02d}m" if h else f"{m}m"


def _fmt_day(ms: int) -> str:
    """Portable 'Jun 4, 2026' (avoids the non-Windows %-d strftime token)."""
    dt = datetime.datetime.utcfromtimestamp(ms / 1000)
    return f"{dt.strftime('%b')} {dt.day}, {dt.year}"


def _compact(n: float) -> str:
    if n >= 1e6:
        return f"{n/1e6:.1f}M"
    if n >= 1e3:
        return f"{n/1e3:.1f}k"
    return str(int(n))


def _deck_filter_dids(col, cfg) -> set | None:
    """Set of deck ids to include (top-level name match, children included), or
    None for 'all decks'."""
    include = (cfg.get("data") or {}).get("includeDecks") or []
    if not include:
        return None
    wanted = set(include)
    dids = set()
    for d in col.decks.all_names_and_ids():
        if _top_deck(d.name) in wanted or d.name in wanted:
            dids.add(d.id)
    return dids


def _deck_where(include_dids):
    if not include_dids:
        return "", []
    qs = ",".join("?" * len(include_dids))
    return f" AND did IN ({qs})", list(include_dids)


def _day_cutoff(col, cfg) -> int:
    """End-of-today timestamp (epoch sec). Honors a custom rollover hour from
    settings; otherwise uses Anki's, with a manual fallback for safety."""
    hour = (cfg.get("data") or {}).get("cutoffHour")
    if hour is None:
        try:
            return int(col.sched.day_cutoff)
        except Exception:
            hour = col.get_config("rollover", 4)
    now = datetime.datetime.now()
    cutoff = now.replace(hour=int(hour), minute=0, second=0, microsecond=0)
    if cutoff <= now:
        cutoff += datetime.timedelta(days=1)
    return int(cutoff.timestamp())


# ---------------------------------------------------------------- main
def build_dataset(col, cfg: Dict[str, Any]) -> Dict[str, Any]:
    data_cfg = cfg.get("data") or {}
    mature_days = int(data_cfg.get("matureThresholdDays") or 21)

    day_cutoff = _day_cutoff(col, cfg)                # end of "today" (epoch sec)
    window_start_sec = day_cutoff - N_DAYS * DAY_SEC
    include_dids = _deck_filter_dids(col, cfg)

    # cid -> did, and did -> top-level deck name (current deck; revlog has none).
    deck_name = {d.id: d.name for d in col.decks.all_names_and_ids()}
    did_top = {did: _top_deck(name) for did, name in deck_name.items()}
    cid_did = {cid: did for cid, did in col.db.all("SELECT id, did FROM cards")}

    # Pre-build day buckets (oldest first; index N-1 == today).
    days: List[Dict[str, Any]] = []
    for d in range(N_DAYS - 1, -1, -1):
        end = day_cutoff - d * DAY_SEC
        dow = (datetime.datetime.fromtimestamp(end - 1).weekday() + 1) % 7  # JS 0=Sun
        days.append({
            "date": _civil_utc_midnight_ms(end), "dow": dow, "studied": False,
            "reviews": 0, "newC": 0, "learning": 0, "relearning": 0, "total": 0,
            "timeSec": 0.0, "again": 0, "hard": 0, "good": 0, "easy": 0,
            "retention": 0.0, "deckSplit": {}, "mature": 0,
        })

    deck_totals: Dict[str, int] = {}
    deck_graded: Dict[str, int] = {}
    deck_again: Dict[str, int] = {}
    hour_counts = [0] * 24
    hour_rev = [0] * 24
    hour_again = [0] * 24

    # Single pass over the windowed revlog.
    rows = col.db.all(
        "SELECT id, cid, ease, time, type, lastIvl FROM revlog WHERE id >= ?",
        window_start_sec * 1000,
    )
    for rid, cid, ease, time_ms, rtype, last_ivl in rows:
        if rtype == 4:  # manual reschedule — not an actual review
            continue
        did = cid_did.get(cid)
        if include_dids is not None and did not in include_dids:
            continue
        rev_sec = rid / 1000.0
        days_ago = int((day_cutoff - rev_sec) // DAY_SEC)
        if days_ago < 0 or days_ago >= N_DAYS:
            continue
        rec = days[(N_DAYS - 1) - days_ago]
        rec["total"] += 1
        rec["timeSec"] += (time_ms or 0) / 1000.0
        if rtype == 0:
            rec["learning"] += 1
            if (last_ivl or 0) == 0:
                rec["newC"] += 1
        elif rtype == 1:
            rec["reviews"] += 1
        elif rtype == 2:
            rec["relearning"] += 1

        deck = did_top.get(did, "Default")
        rec["deckSplit"][deck] = rec["deckSplit"].get(deck, 0) + 1
        deck_totals[deck] = deck_totals.get(deck, 0) + 1

        if rtype in (1, 2) and ease in (1, 2, 3, 4):
            rec[{1: "again", 2: "hard", 3: "good", 4: "easy"}[ease]] += 1
            deck_graded[deck] = deck_graded.get(deck, 0) + 1
            hour_rev[datetime.datetime.fromtimestamp(rev_sec).hour] += 1
            if ease == 1:
                deck_again[deck] = deck_again.get(deck, 0) + 1
                hour_again[datetime.datetime.fromtimestamp(rev_sec).hour] += 1
        hour_counts[datetime.datetime.fromtimestamp(rev_sec).hour] += 1

    for rec in days:
        rec["timeSec"] = int(round(rec["timeSec"]))
        graded = rec["again"] + rec["hard"] + rec["good"] + rec["easy"]
        rec["retention"] = (graded - rec["again"]) / graded if graded else 0.0
        rec["studied"] = rec["total"] > 0

    today_ms = days[-1]["date"]

    # decks ordered by reviews this window, with real per-deck retention
    decks = []
    for dk, _cnt in sorted(deck_totals.items(), key=lambda kv: -kv[1]):
        g = deck_graded.get(dk, 0)
        retain = (g - deck_again.get(dk, 0)) / g if g else 0.0
        decks.append({"name": dk, "retain": retain})

    total_h = sum(hour_counts) or 1
    hourly = [
        {"hour": h, "pct": hour_counts[h] / total_h,
         "retention": ((hour_rev[h] - hour_again[h]) / hour_rev[h]) if hour_rev[h] else 0.0}
        for h in range(24)
    ]

    def guard(fn, fallback):
        try:
            return fn()
        except Exception as e:
            print("Recall: section failed, using fallback —", repr(e))
            return fallback

    forecast = guard(lambda: _forecast(col, mature_days, include_dids),
                     [{"day": k, "young": 0, "mature": 0, "total": 0} for k in range(30)])
    fsrs = guard(lambda: _fsrs(col, mature_days, include_dids), _fsrs_fallback())
    records = guard(lambda: _records(col, days), [])
    achievements = guard(lambda: _achievements(col, days, fsrs, decks), [])

    return {
        "today": today_ms, "decks": decks, "days": days, "hourly": hourly,
        "forecast": forecast, "fsrs": fsrs, "records": records, "achievements": achievements,
    }


def _forecast(col, mature_days, include_dids):
    today = col.sched.today
    extra, params = _deck_where(include_dids)
    rows = col.db.all(
        f"SELECT due, ivl FROM cards WHERE queue=2 AND due BETWEEN ? AND ?{extra}",
        today, today + 29, *params,
    )
    buckets = [{"day": k, "young": 0, "mature": 0, "total": 0} for k in range(30)]
    for due, ivl in rows:
        k = int(due) - today
        if 0 <= k < 30:
            b = buckets[k]
            b["mature" if (ivl or 0) >= mature_days else "young"] += 1
            b["total"] += 1
    return buckets


def _fsrs_fallback():
    return {
        "stability": 0, "difficulty": 0.0, "retrievability": 0.0, "mature": 0, "young": 0,
        "retr": [{"band": b, "n": 0} for b in ("<70%", "70–80%", "80–90%", "90–95%", ">95%")],
    }


def _fsrs(col, mature_days, include_dids):
    today = col.sched.today
    extra, params = _deck_where(include_dids)
    mature = col.db.scalar(f"SELECT count() FROM cards WHERE queue=2 AND ivl>=?{extra}", mature_days, *params) or 0
    young = col.db.scalar(
        f"SELECT count() FROM cards WHERE ((queue=2 AND ivl<?) OR queue IN (1,3)){extra}", mature_days, *params
    ) or 0

    # Per-card FSRS memory state from the cards.data JSON (fast, bulk).
    true_due = "CASE WHEN odid==0 THEN due ELSE odue END"
    rows = col.db.all(
        f"""SELECT {true_due} AS true_due, ivl,
                   json_extract(data,'$.s') AS s, json_extract(data,'$.d') AS d
            FROM cards
            WHERE queue=2 AND data!='' AND json_extract(data,'$.s') IS NOT NULL{extra}""",
        *params,
    )

    bands = [0, 0, 0, 0, 0]  # <70, 70-80, 80-90, 90-95, >95
    s_sum = d_sum = r_sum = 0.0
    n = 0
    if rows:
        for true_due, ivl, s, d in rows:
            try:
                s = float(s)
            except (TypeError, ValueError):
                continue
            elapsed = max(0, today - (int(true_due) - int(ivl or 0)))
            r = _power_forgetting_curve(elapsed, s)
            n += 1
            s_sum += s
            r_sum += r
            if d is not None:
                d_sum += (float(d) - 1.0) / 9.0
            if r < 0.70:
                bands[0] += 1
            elif r < 0.80:
                bands[1] += 1
            elif r < 0.90:
                bands[2] += 1
            elif r < 0.95:
                bands[3] += 1
            else:
                bands[4] += 1

    if n:
        stability = int(round(s_sum / n))
        difficulty = d_sum / n
        retrievability = r_sum / n
    else:
        # FSRS off / no memory state — fall back to interval-based stand-ins.
        stability = int(round(col.db.scalar(f"SELECT avg(ivl) FROM cards WHERE queue=2{extra}", *params) or 0))
        life_rev = col.db.scalar("SELECT count() FROM revlog WHERE type IN (1,2)") or 0
        life_again = col.db.scalar("SELECT count() FROM revlog WHERE type IN (1,2) AND ease=1") or 0
        difficulty = 0.0
        retrievability = (life_rev - life_again) / life_rev if life_rev else 0.0
        bands[4] = int(mature)  # no per-card recall available

    labels = ("<70%", "70–80%", "80–90%", "90–95%", ">95%")
    return {
        "stability": stability, "difficulty": difficulty, "retrievability": retrievability,
        "mature": int(mature), "young": int(young),
        "retr": [{"band": labels[i], "n": bands[i]} for i in range(5)],
    }


def _records(col, days):
    best = max(days, key=lambda d: d["total"])
    best_time = max(days, key=lambda d: d["timeSec"])
    longest = run = 0
    for d in days:
        if d["studied"]:
            run += 1
            longest = max(longest, run)
        else:
            run = 0
    life_cards = col.db.scalar("SELECT count() FROM revlog WHERE type IN (0,1,2,3)") or 0
    life_time = (col.db.scalar("SELECT sum(time) FROM revlog") or 0) / 1000.0
    life_rev = col.db.scalar("SELECT count() FROM revlog WHERE type IN (1,2)") or 0
    life_again = col.db.scalar("SELECT count() FROM revlog WHERE type IN (1,2) AND ease=1") or 0
    life_ret = (life_rev - life_again) / life_rev if life_rev else 0
    return [
        {"label": "Best day", "value": f"{best['total']:,}", "unit": "cards", "sub": _fmt_day(best["date"])},
        {"label": "Longest streak", "value": f"{longest:,}", "unit": "days", "sub": "all-time"},
        {"label": "Most time / day", "value": _fmt_dur(best_time["timeSec"]), "unit": "", "sub": _fmt_day(best_time["date"])},
        {"label": "Lifetime cards", "value": _compact(life_cards), "unit": "reviews", "sub": "all-time"},
        {"label": "Lifetime focus", "value": f"{round(life_time/3600):,}", "unit": "hours", "sub": "total study"},
        {"label": "True retention", "value": f"{round(life_ret*100)}%", "unit": "", "sub": "all-time avg"},
    ]


def _achievements(col, days, fsrs, decks):
    streak = 0
    for d in reversed(days):
        if d["studied"]:
            streak += 1
        else:
            break
    life_cards = col.db.scalar("SELECT count() FROM revlog WHERE type IN (0,1,2,3)") or 0
    return [
        {"name": "Century", "desc": "100-day streak", "icon": "flame", "got": streak >= 100},
        {"name": "10k Club", "desc": "10,000 reviews", "icon": "layers", "got": life_cards >= 10000},
        {"name": "Polyglot", "desc": "5 active decks", "icon": "globe", "got": len(decks) >= 5},
        {"name": "Iron Will", "desc": "365-day streak", "icon": "shield", "got": streak >= 365},
        {"name": "Master", "desc": "10,000 mature cards", "icon": "crown", "got": fsrs.get("mature", 0) >= 10000},
        {"name": "Lifer", "desc": "100k lifetime reviews", "icon": "infinity", "got": life_cards >= 100000},
    ]
