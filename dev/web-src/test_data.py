"""Offline logic test for addonismaximus/data.py using a fake collection.
Run: python3 web-src/test_data.py  (no Anki needed — data.py has no aqt imports)."""
import os, sys, time, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("addonismaximus_data", os.path.join(HERE, "..", "..", "addonismaximus", "data.py"))
data = importlib.util.module_from_spec(spec)
spec.loader.exec_module(data)

NOW = int(time.time())
CUTOFF = NOW + 3600
TODAY = 1000  # days since creation


class FakeDecks:
    def all_names_and_ids(self):
        class D:
            def __init__(s, i, n): s.id, s.name = i, n
        return [D(1, "Default"), D(2, "日本語 Core"), D(3, "日本語 Core::Kanji"), D(4, "Anatomy")]


class FakeDB:
    def all(self, sql, *params):
        if "SELECT id, did FROM cards" in sql:
            return [(10, 2), (11, 3), (12, 4), (13, 1)]
        if "MIN(id) FROM revlog WHERE type IN" in sql:   # first review per card
            base = (CUTOFF - 200 * 86400) * 1000
            return [(cid, base + cid * 86400 * 1000) for cid in (10, 11, 12, 13)]
        if "MIN(id) FROM revlog WHERE ivl >=" in sql:    # first time mature per card
            base = (CUTOFF - 150 * 86400) * 1000
            return [(10, base), (12, base + 86400 * 1000)]
        if "SELECT id, did, type, ivl FROM cards" in sql:  # projection card states
            # (id, did, type, ivl): two mature, one young, one new — plus a
            # SUSPENDED unseen card (14): suspended decks must count as intake.
            cards = [(10, 2, 2, 40), (11, 3, 2, 5), (12, 4, 2, 30), (13, 1, 0, 0), (14, 2, 0, 0)]
            if "queue != -1" in sql:   # excludeSuspended: drop the suspended card 14
                cards = [c for c in cards if c[0] != 14]
            return cards
        if "FROM revlog WHERE id >= ?" in sql:
            rows = []
            for d in range(0, 40):           # 40 days of history
                base = (CUTOFF - d * 86400 - 3600) * 1000
                for j in range(12):           # 12 reviews/day
                    cid = [10, 11, 12, 13][j % 4]
                    ease = [1, 2, 3, 3, 3, 4][j % 6]
                    rtype = [1, 1, 1, 0, 2, 1][j % 6]
                    last_ivl = 0 if (rtype == 0 and j % 2 == 0) else 5
                    rows.append((base - j * 1000, cid, ease, 8000, rtype, last_ivl))
                rows.append((base, 13, 0, 1000, 4, 0))  # a manual reschedule (skipped)
            return rows
        if "due BETWEEN" in sql:             # forecast
            return [(TODAY + k % 30, 30 if k % 3 else 5) for k in range(60)]
        return []

    def scalar(self, sql, *params):
        if "type IN (0,1,2,3)" in sql: return 53000
        if "sum(time)" in sql: return 9000 * 60 * 1000
        if "type IN (1,2) AND ease=1" in sql: return 4000
        if "type IN (1,2)" in sql: return 40000
        return 0


class FakeNode:
    def __init__(s, name, deck_id, new, learn, review, children=()):
        s.name, s.deck_id = name, deck_id
        s.new_count, s.learn_count, s.review_count = new, learn, review
        s.children = list(children)


class FakeSched:
    day_cutoff = CUTOFF
    today = TODAY

    def deck_due_tree(self):
        # Root with top-level decks; "Default" has nothing pending (dropped).
        return FakeNode("", 0, 0, 0, 0, children=[
            FakeNode("Default", 1, 0, 0, 0),
            FakeNode("日本語 Core", 2, 5, 2, 30),
            FakeNode("Anatomy", 4, 3, 0, 10),
        ])


class FakeCol:
    sched = FakeSched()
    decks = FakeDecks()
    db = FakeDB()
    def get_config(self, k, default=None): return default


cfg = {"data": {"matureThresholdDays": 21, "cutoffHour": None, "includeDecks": [], "streakMinCards": 1}}
raw = data.build_dataset(FakeCol(), cfg)

# ---- assertions ----
assert set(raw) == {"today", "decks", "allDecks", "days", "hourly", "forecast", "projection", "pending"}, raw.keys()
assert isinstance(raw["allDecks"], list) and all(isinstance(n, str) for n in raw["allDecks"]), raw["allDecks"]
assert len(raw["days"]) == data.N_DAYS, len(raw["days"])
assert len(raw["hourly"]) == 24
assert len(raw["forecast"]) == 30

studied = [d for d in raw["days"] if d["studied"]]
assert studied, "no studied days"
d0 = raw["days"][-1]  # today
# total must exclude the manual (type 4) row: 12 real reps, not 13
assert d0["total"] == 12, d0["total"]
assert d0["reviews"] + d0["learning"] + d0["relearning"] == 12, d0
assert d0["timeSec"] > 0
# answer-button retention sane
assert 0 <= d0["retention"] <= 1, d0["retention"]

# deck split present + retention computed per deck
assert raw["decks"], "no decks"
assert all(0 <= dk["retain"] <= 1 for dk in raw["decks"])
top = raw["decks"][0]
assert top["name"] in {"日本語 Core", "Anatomy", "Default"}, top

# projection: one entry per top deck with cards, sane fields, growing series
proj = raw["projection"]
assert proj, "no projection"
for p in proj:
    assert set(p) >= {"deck", "mature", "young", "new", "introPerDay", "typicalDays",
                      "samples", "eta90Days", "eta90Date", "series"}, p.keys()
    assert p["mature"] + p["young"] + p["new"] > 0
    vals = [s["mature"] for s in p["series"]]
    assert vals == sorted(vals), "projected mature count must not decrease"
    assert vals[0] == p["mature"], "series must start at today's mature count"
jp = next(p for p in proj if p["deck"] == "日本語 Core")
# cid 10 mature (ivl 40) + cid 11 young (ivl 5, subdeck) + cid 14 suspended
# unseen — by default suspended cards count toward the future pipeline as "new".
assert jp["mature"] == 1 and jp["young"] == 1 and jp["new"] == 1, jp

# excludeSuspended: the suspended unseen card (14) drops out of the "new" pipeline.
cfg_susp = {"data": {"matureThresholdDays": 21, "cutoffHour": None, "includeDecks": [],
                     "streakMinCards": 1, "excludeSuspended": True}}
raw_susp = data.build_dataset(FakeCol(), cfg_susp)
jp2 = next(p for p in raw_susp["projection"] if p["deck"] == "日本語 Core")
assert jp2["mature"] == 1 and jp2["young"] == 1 and jp2["new"] == 0, jp2

# pending: per-top-deck due counts from the scheduler tree; empty decks dropped,
# sorted busiest-first; each row carries new/learn/review.
pend = raw["pending"]
assert [r["deck"] for r in pend] == ["日本語 Core", "Anatomy"], pend  # Default (0) dropped, sorted by total
assert pend[0] == {"deck": "日本語 Core", "new": 5, "learn": 2, "review": 30}, pend[0]
assert pend[1] == {"deck": "Anatomy", "new": 3, "learn": 0, "review": 10}, pend[1]
# include filter scopes pending to the selected top deck(s).
raw_jp = data.build_dataset(FakeCol(), {"data": {"matureThresholdDays": 21, "cutoffHour": None,
                                                 "includeDecks": ["日本語 Core"], "streakMinCards": 1}})
assert [r["deck"] for r in raw_jp["pending"]] == ["日本語 Core"], raw_jp["pending"]

import json
print("days:", len(raw["days"]), "| today total:", d0["total"], "| decks:", [d["name"] for d in raw["decks"]])
print("approx JSON payload size:", round(len(json.dumps(raw)) / 1024), "KB")
print("\nALL ASSERTIONS PASSED ✓")
