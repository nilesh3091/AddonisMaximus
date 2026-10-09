"""Build the `raw` dataset (the shape consumed by web-src/src/data.js) from a
real Anki collection.

`raw` contract (mirror of data.js):
  { today, dayCutoff, decks:[{name,retain}], days:[{date,dow,studied,reviews,newC,learning,
    relearning,total,timeSec,again,hard,good,easy,retention,deckSplit}],
    hourly, forecast (FORECAST_DAYS long),
    projection:[{deck,mature,young,new,introPerDay,typicalDays,samples,
                 eta90Days,eta90Date,series:[{t,mature}],
                 milestones:[{pct,count,days,date}]}],
    pending:[{deck,new,learn,review}] }

Each section is computed defensively — a failure in one (e.g. an unusual
scheduler state) degrades that section rather than taking down the whole window.
"""
from __future__ import annotations

import bisect
import datetime
from typing import Any, Dict, List

# How far ahead the due-card forecast reaches. The heat-map runs the rest of this
# month plus HEAT_AHEAD (2) months beyond it, which needs up to ~93 days; the
# Forecast card still shows only its first 30.
FORECAST_DAYS = 93

DAY_SEC = 86400
N_DAYS = 365 * 3 + 30  # ~3 years of daily history for the trend/calendar

# revlog.type: 0 learn · 1 review · 2 relearn · 3 filtered/cram · 4 manual (no answer)
REVLOG_STUDY_TYPES = (0, 1, 2, 3)


# ---------------------------------------------------------------- helpers
def _civil_utc_midnight_ms(end_sec: int) -> int:
    """Given the end-of-Anki-day timestamp, return UTC-midnight ms of that day's
    civil (local) date — so JS `toLocaleDateString(timeZone:'UTC')` shows the
    correct calendar day regardless of the user's zone."""
    civ = datetime.datetime.fromtimestamp(end_sec - 1)
    return int(datetime.datetime(civ.year, civ.month, civ.day, tzinfo=datetime.timezone.utc).timestamp() * 1000)


def _top_deck(name: str) -> str:
    return name.split("::", 1)[0] if name else "Default"


def _leaf(name: str) -> str:
    """The deck's own name, without its parents ("A::B::C" -> "C")."""
    return name.split("::")[-1] if name else "Default"


def _group_name(name: str, root: str | None) -> str:
    """Which bucket a deck's reviews are counted under.

    Collection scope groups by top-level deck, which is what the whole panel has
    always shown. A deck scope (the overview screen) groups by the level *below*
    the deck you opened, so "AnKing::Anatomy::Head" lands in "Anatomy" and cards
    sitting directly in the deck land under its own leaf name — grouping a single
    deck's history by top deck would collapse the whole card to one bar.
    """
    if not name:
        return "Default"
    if root is None:
        return _top_deck(name)
    if name == root:
        return _leaf(root)
    if name.startswith(root + "::"):
        return name[len(root) + 2:].split("::", 1)[0]
    return _top_deck(name)          # out of scope; filtered out anyway


def _scope_dids(col, deck_id) -> set:
    """The opened deck plus every subdeck under it."""
    root = None
    for d in col.decks.all_names_and_ids():
        if d.id == deck_id:
            root = d.name
            break
    if root is None:
        return {deck_id}
    return {d.id for d in col.decks.all_names_and_ids()
            if d.name == root or d.name.startswith(root + "::")}


def _deck_filter_dids(col, cfg, deck_id=None) -> set | None:
    """Set of deck ids to include (top-level name match, children included), or
    None for 'all decks'.

    `deck_id` — the deck whose overview screen we are drawing on — overrides the
    settings filter outright rather than intersecting with it: the user asked for
    this deck by opening it, and an intersection would render an empty panel on
    every deck outside their saved filter.
    """
    if deck_id is not None:
        return _scope_dids(col, deck_id)
    include = (cfg.get("data") or {}).get("includeDecks") or []
    if not include:
        return None
    wanted = set(include)
    dids = set()
    for d in col.decks.all_names_and_ids():
        if _top_deck(d.name) in wanted or d.name in wanted:
            dids.add(d.id)
    return dids


def _deck_where(include_dids, alias=""):
    # `alias` qualifies the column for queries that join cards to another table
    # (the projection's revlog scan), so the same filter serves both.
    #
    # None and set() mean opposite things and must not collapse into the same
    # "no WHERE clause". None is "all decks"; an empty set is "the decks you
    # picked no longer exist" — _deck_filter_dids returns that when includeDecks
    # is non-empty but nothing matches (a filtered deck later renamed, deleted,
    # or nested under a parent, since _top_deck makes "Anatomy" stop matching
    # "Medicine::Anatomy"). The row-loop consumers test `is not None` and skip
    # everything, so letting the SQL consumers fall through to "no filter" made
    # the panel contradict itself: blank heat-map, zero streak and empty Pending
    # next to a Forecast covering the whole collection. Match the row loops and
    # return nothing; the stale names stay in the settings picker, so one toggle
    # undoes it.
    col = f"{alias}.did" if alias else "did"
    if include_dids is None:
        return "", []
    if not include_dids:
        return " AND 1=0", []
    qs = ",".join("?" * len(include_dids))
    return f" AND {col} IN ({qs})", list(include_dids)


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
def build_dataset(col, cfg: Dict[str, Any], want_projection: bool = True,
                  deck_id=None) -> Dict[str, Any]:
    """`deck_id` scopes the whole dataset to one deck and its subdecks — that is
    what the deck-overview panel renders; None is the whole collection (the home
    screen), honouring the settings deck filter as before.

    `want_projection=False` skips _projection entirely.

    It is by far the most expensive section — two GROUP BY scans of the whole
    revlog plus a full card table read — and it feeds exactly one card (Maturity
    ETA), which ships hidden. The caller (core.start_build) passes False whenever
    that card is neither visible in the carousel nor sitting in a multi-mode
    block, and puts the answer in the dataset cache key so enabling the card
    rebuilds rather than serving the empty list."""
    data_cfg = cfg.get("data") or {}
    mature_days = int(data_cfg.get("matureThresholdDays") or 21)

    day_cutoff = _day_cutoff(col, cfg)                # end of "today" (epoch sec)
    window_start_sec = day_cutoff - N_DAYS * DAY_SEC
    include_dids = _deck_filter_dids(col, cfg, deck_id)
    exclude_suspended = bool(data_cfg.get("excludeSuspended"))

    # cid -> did, and did -> the bucket its reviews count under (current deck;
    # the revlog carries none). Top-level deck normally; one level below the
    # opened deck when we are scoped to one.
    deck_name = {d.id: d.name for d in col.decks.all_names_and_ids()}
    scope_root = deck_name.get(deck_id) if deck_id is not None else None
    did_group = {did: _group_name(name, scope_root) for did, name in deck_name.items()}
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
            "retention": 0.0, "deckSplit": {},
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

        deck = did_group.get(did, "Default")
        rec["deckSplit"][deck] = rec["deckSplit"].get(deck, 0) + 1
        deck_totals[deck] = deck_totals.get(deck, 0) + 1

        # One fromtimestamp per row, not three — this runs once per revlog row
        # over a ~3-year window, on Anki's main thread, so the duplicates were
        # a measurable slice of the deck-browser render on large collections.
        hour = datetime.datetime.fromtimestamp(rev_sec).hour
        if rtype in (1, 2) and ease in (1, 2, 3, 4):
            rec[{1: "again", 2: "hard", 3: "good", 4: "easy"}[ease]] += 1
            deck_graded[deck] = deck_graded.get(deck, 0) + 1
            hour_rev[hour] += 1
            if ease == 1:
                deck_again[deck] = deck_again.get(deck, 0) + 1
                hour_again[hour] += 1
        hour_counts[hour] += 1

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
            print("Addonis Maximus: section failed, using fallback —", repr(e))
            return fallback

    forecast = guard(lambda: _forecast(col, mature_days, include_dids),
                     [{"day": k, "young": 0, "mature": 0, "total": 0} for k in range(FORECAST_DAYS)])
    projection = (guard(lambda: _projection(col, mature_days, include_dids, day_cutoff, did_group, exclude_suspended), [])
                  if want_projection else [])
    pending = guard(lambda: _pending(col, include_dids, deck_id, scope_root), [])

    # Every top-level deck in the collection, regardless of the include filter, the
    # deck scope, or whether it has reviews in the window. This drives the Settings
    # deck picker — it must NOT be filtered, or excluding a deck would hide the
    # control to undo it (and on a deck screen the picker would list one deck).
    all_decks = sorted({_top_deck(name) for name in deck_name.values()})

    return {
        "today": today_ms, "decks": decks, "allDecks": all_decks, "days": days, "hourly": hourly,
        # End of the current Anki day (epoch ms) — the web layer divides the time
        # left before this by your hour-of-day study pattern for the "cards you
        # can still do today" estimate. Cached datasets can carry a stale cutoff,
        # so buildAnki() rolls it forward if it has already passed.
        "dayCutoff": day_cutoff * 1000,
        "forecast": forecast,
        "projection": projection, "pending": pending,
    }


def _pending(col, include_dids, deck_id=None, scope_root=None):
    """Cards waiting to be studied today, per top-level deck — new / learning /
    due. Read straight from the scheduler's due tree so the counts match exactly
    what Anki shows in the deck list (daily new/review limits already applied).
    Decks with nothing pending are dropped; the list is sorted busiest-first."""
    if deck_id is not None:
        return _pending_in_deck(col, deck_id, scope_root)
    tree = col.sched.deck_due_tree()
    rows: Dict[str, Dict[str, Any]] = {}
    for node in getattr(tree, "children", None) or []:
        if include_dids is not None and getattr(node, "deck_id", None) not in include_dids:
            continue
        name = _top_deck(getattr(node, "name", "") or "Default")
        r = rows.setdefault(name, {"deck": name, "new": 0, "learn": 0, "review": 0})
        r["new"] += int(getattr(node, "new_count", 0) or 0)
        r["learn"] += int(getattr(node, "learn_count", 0) or 0)
        r["review"] += int(getattr(node, "review_count", 0) or 0)
    out = [r for r in rows.values() if (r["new"] + r["learn"] + r["review"]) > 0]
    out.sort(key=lambda r: -(r["new"] + r["learn"] + r["review"]))
    return out


def _pending_in_deck(col, deck_id, scope_root=None):
    """Same, scoped to one deck: a row per subdeck, plus one for the cards that
    sit directly in the deck itself.

    A node's counts already include its children (that is what Anki's deck list
    shows), so the parent's own share is the remainder — floored at zero, since
    the parent's daily limits can cap the total below the sum of its children.
    """
    node = col.sched.deck_due_tree(deck_id)
    if node is None:
        return []

    def counts(n):
        return (int(getattr(n, "new_count", 0) or 0),
                int(getattr(n, "learn_count", 0) or 0),
                int(getattr(n, "review_count", 0) or 0))

    kids = list(getattr(node, "children", None) or [])
    rows = [{"deck": _leaf(getattr(k, "name", "") or "Default"),
             "new": c[0], "learn": c[1], "review": c[2]}
            for k, c in ((k, counts(k)) for k in kids)]
    new, learn, review = counts(node)
    own = (max(0, new - sum(r["new"] for r in rows)),
           max(0, learn - sum(r["learn"] for r in rows)),
           max(0, review - sum(r["review"] for r in rows)))
    if not kids or sum(own) > 0:
        rows.append({"deck": _leaf(scope_root or getattr(node, "name", "") or "Default"),
                     "new": own[0], "learn": own[1], "review": own[2]})
    out = [r for r in rows if (r["new"] + r["learn"] + r["review"]) > 0]
    out.sort(key=lambda r: -(r["new"] + r["learn"] + r["review"]))
    return out


def _forecast(col, mature_days, include_dids):
    today = col.sched.today
    extra, params = _deck_where(include_dids)
    rows = col.db.all(
        f"SELECT due, ivl FROM cards WHERE queue=2 AND due BETWEEN ? AND ?{extra}",
        today, today + FORECAST_DAYS - 1, *params,
    )
    buckets = [{"day": k, "young": 0, "mature": 0, "total": 0} for k in range(FORECAST_DAYS)]
    for due, ivl in rows:
        k = int(due) - today
        if 0 <= k < FORECAST_DAYS:
            b = buckets[k]
            b["mature" if (ivl or 0) >= mature_days else "young"] += 1
            b["total"] += 1
    return buckets


def _projection(col, mature_days, include_dids, day_cutoff, did_group, exclude_suspended=False):
    """Per-deck-group maturity ETA — when will the deck be ~90% mature?

    Empirical, from the account's own history: measure how long each
    already-mature card took (first review -> first interval >= threshold),
    take the deck's median, then project the remaining young cards onto that
    distribution and queue the unseen new cards at the recent intake rate.
    """
    DAY_MS = DAY_SEC * 1000
    HORIZON = 730  # cap projections at 2 years out
    now_ms = day_cutoff * 1000
    today_ms = _civil_utc_midnight_ms(day_cutoff)

    intake_floor_ms = now_ms - 30 * DAY_MS

    # Current card states grouped by top deck. By default ALL cards count
    # (suspended included): people routinely keep a big deck suspended and
    # unsuspend through a syllabus, so suspended unseen cards are future intake.
    # But a deck that is mostly a suspended backlog (e.g. a 30k-card AnKing deck)
    # swamps the "new" pipeline and pushes every ETA to "2+ years"; the
    # excludeSuspended setting drops those (queue = -1) so the projection
    # reflects only the cards actually in rotation. Classify by card type
    # (survives suspend/bury), not queue: type 0 = never studied -> "new".
    extra, params = _deck_where(include_dids)
    susp = " AND queue != -1" if exclude_suspended else ""
    rows = col.db.all(
        f"SELECT id, did, type, ivl FROM cards WHERE 1=1{susp}{extra}",
        *params,
    )

    # Per-card milestones — first study, first time mature — in ONE pass over the
    # revlog, joined to exactly the cards the loop below iterates.
    #
    # This used to be two separate `GROUP BY cid` scans of the entire table, each
    # reading every row ever written including rows for deleted cards and for
    # decks the include-filter excludes: 2.2s + 1.9s of a 6.0s build at 1.2M
    # revlog rows. The two CASE aggregates compute the identical values in a
    # single 2.1s scan (a card with no matching row still yields NULL, which is
    # what the old dict lookups returned by being absent), and the join drops
    # everything out of scope — 0.68s with a two-deck filter.
    extra_c, params_c = _deck_where(include_dids, "c")
    susp_c = " AND c.queue != -1" if exclude_suspended else ""
    milestones_ms = {
        cid: (first, mature) for cid, first, mature in col.db.all(
            "SELECT r.cid,"
            "       MIN(CASE WHEN r.type IN (0,1,2,3) THEN r.id END),"
            "       MIN(CASE WHEN r.ivl >= ? THEN r.id END)"
            "  FROM revlog r JOIN cards c ON c.id = r.cid"
            f" WHERE 1=1{susp_c}{extra_c}"
            " GROUP BY r.cid",
            mature_days, *params_c,
        )
    }

    decks: Dict[str, Dict[str, Any]] = {}
    for cid, did, ctype, ivl in rows:
        name = did_group.get(did, "Default")
        b = decks.setdefault(name, {
            "deck": name, "mature": 0, "young": 0, "new": 0,
            "samples": [], "elapsed": [], "intro30": 0,
        })
        f, m = milestones_ms.get(cid, (None, None))
        if f is not None and m is not None and m >= f:
            b["samples"].append((m - f) / DAY_MS)
        if f is not None and f >= intake_floor_ms:
            b["intro30"] += 1
        if ctype == 0:
            b["new"] += 1
        elif (ivl or 0) >= mature_days:
            b["mature"] += 1
        else:
            b["young"] += 1
            b["elapsed"].append((now_ms - f) / DAY_MS if f else None)

    def median(xs):
        xs = sorted(xs)
        n = len(xs)
        return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2

    # Small decks borrow the whole-collection median; no history at all falls
    # back to a threshold-derived guess so the card still renders something.
    all_samples = [s for b in decks.values() for s in b["samples"]]
    global_med = median(all_samples) if len(all_samples) >= 12 else mature_days * 2.5

    out = []
    for b in decks.values():
        total = b["mature"] + b["young"] + b["new"]
        if total == 0:
            continue
        med = median(b["samples"]) if len(b["samples"]) >= 12 else global_med
        intro = b["intro30"] / 30.0

        # One future maturation event (days from today) per not-yet-mature card.
        events: List[float] = []
        for el in b["elapsed"]:
            # Young card part-way along the curve; never "due to mature" sooner
            # than a few days out, never later than a full fresh run.
            events.append(med if el is None else min(max(med - el, 3.0), med))
        if intro > 0.03:  # new cards only mature if new cards are being studied
            events.extend((i + 1) / intro + med for i in range(b["new"]))
        events.sort()

        # Day on which the deck first reaches `count` mature cards, read straight
        # off the (uncapped) events list so far-out milestones still resolve to a
        # real date. None when the model never gets there — i.e. the deck has too
        # few not-yet-mature cards queued, which for a stalled deck (intro <= 0.03,
        # so new cards were never added to `events`) is the honest answer.
        def cross_day(count):
            if b["mature"] >= count:
                return 0.0
            need = count - b["mature"]
            return events[need - 1] if need <= len(events) else None

        # 25/50/75/90% checkpoints + their projected day-offsets. MILE_HORIZON is a
        # sanity ceiling (~10 yrs) so a near-stalled deck doesn't print "year 2078".
        MILE_HORIZON = 3650
        milestones = []
        for pct in (25, 50, 75, 90):
            count = (total * pct + 99) // 100  # ceil(pct% of the deck)
            d = cross_day(count)
            if d is not None and d > MILE_HORIZON:
                d = None
            milestones.append({
                "pct": pct, "count": count,
                "days": int(round(d)) if d is not None else None,
                "date": today_ms + int(round(d)) * DAY_MS if d is not None else None,
            })

        # eta90 keeps the tighter 2-year cap for the "at your pace" copy; the
        # timeline's finish date uses the (uncapped) 90% milestone above.
        target = (9 * total + 9) // 10  # ceil(90% of the deck)
        eta = cross_day(target)
        if eta is not None and eta > HORIZON:
            eta = None

        end = int(eta if eta is not None else (events[-1] if events else 0))
        end = min(end + 7, HORIZON)
        series = [
            {"t": today_ms + t * DAY_MS, "mature": b["mature"] + bisect.bisect_right(events, t)}
            for t in range(0, end + 1, 7)
        ]
        out.append({
            "deck": b["deck"], "mature": b["mature"], "young": b["young"], "new": b["new"],
            "introPerDay": round(intro, 2), "typicalDays": int(round(med)),
            "samples": len(b["samples"]),
            "eta90Days": int(round(eta)) if eta is not None else None,
            "eta90Date": today_ms + int(round(eta)) * DAY_MS if eta is not None else None,
            "milestones": milestones,
            "series": series,
        })
    out.sort(key=lambda r: -(r["mature"] + r["young"] + r["new"]))
    return out
