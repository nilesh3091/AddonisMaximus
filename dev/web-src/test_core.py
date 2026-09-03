"""Offline test for addonismaximus/core.py — the dataset cache and the background
build that keeps build_dataset off Anki's Qt main thread.

Run: python3 dev/web-src/test_core.py  (no Anki needed — aqt is stubbed below,
including a QueryOp that queues instead of running, so "still building" is an
inspectable state rather than a race.)"""
import importlib.util, json, os, sys, types

REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")

# ---- stub aqt ---------------------------------------------------------------
class Sched:
    today = 1400
class Decks:
    def all_names_and_ids(self): return []
class Col:
    mod = 100
    sched = Sched()
    decks = Decks()
class MW:
    col = Col()
    class addonManager:
        @staticmethod
        def addonFromModule(_): return "addonismaximus"

aqt = types.ModuleType("aqt"); aqt.mw = MW()
sys.modules["aqt"] = aqt

RUNS = []          # queued QueryOps, run manually so we can inspect in-flight state
class QueryOp:
    def __init__(self, *, parent, op, success): self.op, self.success, self.fail = op, success, None
    def failure(self, f): self.fail = f; return self
    def run_in_background(self): RUNS.append(self)
    def flush(self):
        try: self.success(self.op(MW.col))
        except Exception as e: self.fail(e)
ops = types.ModuleType("aqt.operations"); ops.QueryOp = QueryOp
sys.modules["aqt.operations"] = ops

# ---- load core + a stub `data` sibling --------------------------------------
pkg = types.ModuleType("am"); pkg.__path__ = [os.path.join(REPO, "addonismaximus")]
sys.modules["am"] = pkg

BUILDS = []
data = types.ModuleType("am.data")
def build_dataset(col, cfg, want_projection=True):
    BUILDS.append(want_projection)
    return {"days": [], "projection": ["P"] if want_projection else [], "pending": []}
data.build_dataset = build_dataset
data._pending = lambda col, dids: [{"deck": "D"}]
data._deck_filter_dids = lambda col, cfg: None
sys.modules["am.data"] = data
pkg.data = data

spec = importlib.util.spec_from_file_location("am.core", os.path.join(REPO, "addonismaximus", "core.py"))
core = importlib.util.module_from_spec(spec); sys.modules["am.core"] = core; spec.loader.exec_module(core)

HIDDEN_ALL = {"sections": {"hidden": ["maturity"]}, "appearance": {"blocks": ["goals", "activity", "streak"]}, "data": {}}
VISIBLE = {"sections": {"hidden": []}, "appearance": {"blocks": ["goals", "activity", "streak"]}, "data": {}}
IN_BLOCK = {"sections": {"hidden": ["maturity"]}, "appearance": {"blocks": ["goals", "maturity", "streak"]}, "data": {}}

# 1. wants_projection
assert core.wants_projection(HIDDEN_ALL) is False
assert core.wants_projection(VISIBLE) is True
assert core.wants_projection(IN_BLOCK) is True
assert core.wants_projection(None) is True and core.wants_projection({}) is True
print("wants_projection                                         ok")

# 2. cached_raw never builds, and a cold cache renders "loading" — never sample data
assert core.cached_raw(HIDDEN_ALL) is None
assert BUILDS == [] and RUNS == [], "cached_raw must not touch the collection"
boot = json.loads(core.bootstrap_json(HIDDEN_ALL, "embed", None))
assert boot["data"] is None and boot["dataState"] == "loading", boot
print("cold render is 'loading', builds nothing on the calling thread   ok")

# 3. start_build runs off-thread and only delivers when it finishes
got = []
core.start_build(HIDDEN_ALL, got.append)
assert got == [] and len(RUNS) == 1, "must not deliver synchronously"
# a second render while it's in flight joins rather than starting a rival scan
core.start_build(HIDDEN_ALL, got.append)
assert len(RUNS) == 1, "single-flight broken"
RUNS.pop().flush()
assert len(got) == 2 and got[0] is got[1], got
assert BUILDS == [False], "hidden Maturity card must skip the projection"
assert got[0]["projection"] == []
print("background build: single-flight, both waiters served, projection skipped  ok")

# 4. now it's cached: instant, no rebuild
raw = core.cached_raw(HIDDEN_ALL)
assert raw is not None and RUNS == [] and BUILDS == [False]
assert json.loads(core.bootstrap_json(HIDDEN_ALL, "embed", raw))["dataState"] == "ready"
assert raw["pending"] == [{"deck": "D"}], "pending must be refreshed on every serve"
print("warm cache serves without rebuilding                      ok")

# 5. enabling the Maturity card must miss the cache and rebuild WITH the projection
assert core.cached_raw(VISIBLE) is None, "projection flag must be in the cache key"
core.start_build(VISIBLE, got.append); RUNS.pop().flush()
assert BUILDS == [False, True], BUILDS
assert core.cached_raw(VISIBLE)["projection"] == ["P"]
# ...and the hidden-card dataset is still the one a hidden config gets
assert core.cached_raw(HIDDEN_ALL) is None  # evicted; would rebuild
print("enabling Maturity rebuilds with the projection            ok")

# 6. a collection write invalidates
MW.col.mod = 101
assert core.cached_raw(VISIBLE) is None
print("col.mod bump invalidates                                  ok")

# 7. a failed build delivers None (so the panel stops waiting), never raises
def boom(col, cfg, want_projection=True): raise RuntimeError("db exploded")
data.build_dataset = boom
out = []
core.start_build(VISIBLE, out.append); RUNS.pop().flush()
assert out == [None], out
assert core.cached_raw(VISIBLE) is None
data.build_dataset = build_dataset
print("failed build delivers None and leaves the cache empty     ok")

# 8. no collection open -> 'unavailable', and sample data stays the fallback
MW.col = None
assert core.cached_raw(VISIBLE) is None
assert json.loads(core.bootstrap_json(VISIBLE, "embed", None))["dataState"] == "unavailable"
out = []
core.start_build(VISIBLE, out.append)
assert out == [None] and RUNS == []
print("no collection -> 'unavailable'                            ok")

# 9. an overlapping build for a DIFFERENT scope must not strand the newer render.
#    The deck browser re-renders on every collection op, so a second build can
#    start while the first is still running; if the first one's completion tore
#    down the second's waiter list, the panel that is actually on screen would
#    spin forever.
MW.col = Col()
core.invalidate_cache()
first, second = [], []
core.start_build(HIDDEN_ALL, first.append)     # build A
MW.col.mod = 200                               # a write lands mid-build
core.start_build(HIDDEN_ALL, second.append)    # build B, different cache key
assert len(RUNS) == 2, RUNS
RUNS.pop(0).flush()                            # A finishes first
RUNS.pop(0).flush()                            # ...then B
assert len(first) == 1 and first[0] is not None, first
assert len(second) == 1 and second[0] is not None, "superseded build stranded its successor"
assert core.cached_raw(HIDDEN_ALL) is not None, "the newest build must be what's cached"
print("overlapping builds each reach their own waiter          ok")

print("\nCORE ASSERTIONS PASSED")
