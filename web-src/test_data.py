"""Offline logic test for recall/data.py using a fake collection.
Run: python3 web-src/test_data.py  (no Anki needed — data.py has no aqt imports)."""
import os, sys, time, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("recall_data", os.path.join(HERE, "..", "recall", "data.py"))
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
        if "json_extract" in sql:            # FSRS per-card
            return [(TODAY + (i % 20) - 10, 15, 30.0 + i, 5.0) for i in range(50)]
        return []

    def scalar(self, sql, *params):
        if "ivl>=" in sql: return 1200
        if "ivl<" in sql: return 400
        if "avg(ivl)" in sql: return 42.0
        if "type IN (0,1,2,3)" in sql: return 53000
        if "sum(time)" in sql: return 9000 * 60 * 1000
        if "type IN (1,2) AND ease=1" in sql: return 4000
        if "type IN (1,2)" in sql: return 40000
        return 0


class FakeSched:
    day_cutoff = CUTOFF
    today = TODAY


class FakeCol:
    sched = FakeSched()
    decks = FakeDecks()
    db = FakeDB()
    def get_config(self, k, default=None): return default


cfg = {"data": {"matureThresholdDays": 21, "cutoffHour": None, "includeDecks": [], "streakMinCards": 1}}
raw = data.build_dataset(FakeCol(), cfg)

# ---- assertions ----
assert set(raw) == {"today", "decks", "days", "hourly", "forecast", "fsrs", "records", "achievements"}, raw.keys()
assert len(raw["days"]) == data.N_DAYS, len(raw["days"])
assert len(raw["hourly"]) == 24
assert len(raw["forecast"]) == 30
assert len(raw["fsrs"]["retr"]) == 5
assert len(raw["records"]) == 6

studied = [d for d in raw["days"] if d["studied"]]
assert studied, "no studied days"
d0 = raw["days"][-1]  # today
# total must exclude the manual (type 4) row: 12 real reps, not 13
assert d0["total"] == 12, d0["total"]
assert d0["reviews"] + d0["learning"] + d0["relearning"] == 12, d0
assert d0["timeSec"] > 0
# answer-button retention sane
assert 0 <= d0["retention"] <= 1, d0["retention"]

# FSRS bands sum to the number of FSRS cards (50)
bands = sum(b["n"] for b in raw["fsrs"]["retr"])
assert bands == 50, bands
assert 0 <= raw["fsrs"]["difficulty"] <= 1, raw["fsrs"]["difficulty"]
assert 0 <= raw["fsrs"]["retrievability"] <= 1, raw["fsrs"]["retrievability"]
assert raw["fsrs"]["mature"] == 1200

# deck split present + retention computed per deck
assert raw["decks"], "no decks"
assert all(0 <= dk["retain"] <= 1 for dk in raw["decks"])
top = raw["decks"][0]
assert top["name"] in {"日本語 Core", "Anatomy", "Default"}, top

# forgetting curve sanity: more elapsed -> lower recall
r_fresh = data._power_forgetting_curve(0, 100)
r_old = data._power_forgetting_curve(200, 100)
assert abs(r_fresh - 1.0) < 1e-9 and r_old < r_fresh < 1.0001

import json
print("days:", len(raw["days"]), "| today total:", d0["total"], "| decks:", [d["name"] for d in raw["decks"]])
print("fsrs:", {k: raw["fsrs"][k] for k in ("stability", "difficulty", "retrievability", "mature")})
print("bands:", [(b["band"], b["n"]) for b in raw["fsrs"]["retr"]])
print("records[0]:", raw["records"][0])
print("approx JSON payload size:", round(len(json.dumps(raw)) / 1024), "KB")
print("\nALL ASSERTIONS PASSED ✓")
