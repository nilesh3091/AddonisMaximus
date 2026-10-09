"""Offline test for addonismaximus/embed.py — the three mounts (deck browser,
deck overview, congrats screen), the deck scope each one carries, and the guard
that stops a finished build repainting a page that has moved on.

Run: python3 dev/web-src/test_embed.py  (no Anki needed — aqt is stubbed below,
including a QueryOp that queues instead of running, so a build in flight is an
inspectable state rather than a race.)
"""
import importlib.util, json, os, sys, types

REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")

# ---- stub aqt ---------------------------------------------------------------
class Decks:
    current_id = 7
    def all_names_and_ids(self): return []
    def get_current_id(self): return self.current_id
    def name_if_exists(self, did): return {7: "Anatomy", 9: "Pharm::Antibiotics"}.get(did)
class Sched:
    today = 1400
class Col:
    mod = 100
    sched = Sched()
    decks = Decks()
class Web:
    def __init__(self): self.evals = []
    def eval(self, js): self.evals.append(js)
class MW:
    col = Col()
    web = Web()
    state = "deckBrowser"
    class addonManager:
        @staticmethod
        def addonFromModule(_): return "addonismaximus"
        @staticmethod
        def getConfig(_): return {}
        @staticmethod
        def writeConfig(_, cfg): pass

class Hook:
    def __init__(self): self.callbacks = []
    def append(self, cb): self.callbacks.append(cb)

hooks = types.ModuleType("aqt.gui_hooks")
for name in ("deck_browser_will_render_content", "overview_will_render_content",
             "webview_did_inject_style_into_page", "webview_did_receive_js_message"):
    setattr(hooks, name, Hook())
sys.modules["aqt.gui_hooks"] = hooks

aqt = types.ModuleType("aqt"); aqt.mw = MW(); aqt.gui_hooks = hooks
sys.modules["aqt"] = aqt

RUNS = []
class QueryOp:
    def __init__(self, *, parent, op, success): self.op, self.success, self.fail = op, success, None
    def failure(self, f): self.fail = f; return self
    def run_in_background(self): RUNS.append(self)
    def flush(self):
        try: self.success(self.op(MW.col))
        except Exception as e: self.fail(e)
ops = types.ModuleType("aqt.operations"); ops.QueryOp = QueryOp
sys.modules["aqt.operations"] = ops

# ---- load the add-on package with a stub `data` sibling ---------------------
pkg = types.ModuleType("am"); pkg.__path__ = [os.path.join(REPO, "addonismaximus")]
sys.modules["am"] = pkg

BUILDS = []
data = types.ModuleType("am.data")
def build_dataset(col, cfg, want_projection=True, deck_id=None):
    BUILDS.append(deck_id)
    return {"days": [], "deck": deck_id, "projection": [], "pending": []}
data.build_dataset = build_dataset
data._pending = lambda col, dids, deck_id=None, scope_root=None: []
data._deck_filter_dids = lambda col, cfg, deck_id=None: None
sys.modules["am.data"] = data
pkg.data = data


def load(name):
    spec = importlib.util.spec_from_file_location(
        f"am.{name}", os.path.join(REPO, "addonismaximus", f"{name}.py"))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[f"am.{name}"] = mod
    setattr(pkg, name, mod)
    spec.loader.exec_module(mod)
    return mod

core = load("core")
config_store = load("config_store")
embed = load("embed")


class Content:
    """Stands in for both DeckBrowserContent (.stats) and OverviewContent (.table)."""
    def __init__(self): self.stats = self.table = ""


def boot_of(text):
    """The bootstrap blob out of an injected fragment — or out of the congrats
    screen's eval, which assembles the same three tags in JS."""
    start = text.index("__ADDONISMAXIMUS__ = ") + len("__ADDONISMAXIMUS__ = ")
    return json.JSONDecoder().raw_decode(text[start:])[0]


# 1. every hook is registered
embed.register()
assert len(hooks.deck_browser_will_render_content.callbacks) == 1
assert len(hooks.overview_will_render_content.callbacks) == 1
assert len(hooks.webview_did_inject_style_into_page.callbacks) == 1
assert len(hooks.webview_did_receive_js_message.callbacks) == 1
print("all three mounts + the bridge are registered            ok")

# 2. the deck browser mounts the whole collection...
core.invalidate_cache(); BUILDS.clear()
c = Content()
embed._on_will_render(None, c)
assert c.table == "" and 'id="addonismaximus-embed"' in c.stats
home = boot_of(c.stats)
assert home["scope"] == {"deck": None, "scopeKey": "collection"}, home["scope"]
assert home["dataState"] == "loading" and len(RUNS) == 1, "the render hook must not build inline"
RUNS.pop().flush()
assert BUILDS == [None], BUILDS
print("deck browser mounts the whole collection                ok")

# 3. ...and the deck overview mounts that deck, appended after the counts table.
MW.state = "overview"
c = Content()
embed._on_overview_render(None, c)
assert c.stats == "" and 'id="addonismaximus-embed"' in c.table
deck = boot_of(c.table)
assert deck["scope"] == {"deck": "Anatomy", "scopeKey": "deck:7"}, deck["scope"]
assert deck["mode"] == "embed", "one web layer renders both"
assert len(RUNS) == 1, "the deck must not be served the collection dataset"
RUNS.pop().flush()
assert BUILDS == [None, 7], "the deck is a separate build, not the home one reused"
# the collection dataset is untouched by the visit — walking back is free
assert core.cached_raw(config_store.get_config()) is not None
assert core.cached_raw(config_store.get_config(), 7)["deck"] == 7
print("deck overview mounts that deck, cached beside the home one  ok")

# 4. a finished deck gets the congrats screen instead: no content hook, so the
#    same three tags are evalled into the page — but only there.
MW.web.evals.clear()
embed._on_congrats_page(MW.web)
js = MW.web.evals.pop()
assert "addonismaximus-embed" in js and "deck:7" in js, js
assert boot_of(js)["scope"] == {"deck": "Anatomy", "scopeKey": "deck:7"}, boot_of(js)
embed._on_congrats_page(object())                      # another webview
MW.state = "deckBrowser"
embed._on_congrats_page(MW.web)                        # right webview, wrong screen
assert MW.web.evals == [], "the congrats mount must not fire anywhere else"
print("congrats screen is covered, and nothing else             ok")

# 5. a build that lands after the user has moved on must not repaint the page
#    they are on now: the eval carries the scope it was built for.
MW.web.evals.clear()
embed._push_data({"days": []}, 7)
guard = MW.web.evals.pop()
assert '"deck:7"' in guard and "addonismaximusSetData" in guard, guard
embed._push_data(None, None)
assert '"collection"' in MW.web.evals[-1] and "(null)" in MW.web.evals[-1], MW.web.evals[-1]
print("a delivered dataset is pinned to the scope it was built for  ok")

# 6. the bridge answers `ready`/`reload` for whichever screen is on display —
#    the message itself carries no scope, and cannot: it is fired by a page that
#    may be showing either slice.
MW.state = "overview"
MW.col.decks.current_id = 9
BUILDS.clear(); MW.web.evals.clear()
assert embed._on_message((False, None), "addonismaximus:reload", None) == (True, None)
RUNS.pop().flush()
assert BUILDS == [9], BUILDS
assert '"deck:9"' in MW.web.evals.pop()
MW.state = "deckBrowser"
BUILDS.clear()
assert embed._on_message((False, None), "addonismaximus:ready", None) == (True, None)
assert RUNS == [] and BUILDS == [], "the home dataset is cached; ready must not rescan"
assert '"collection"' in MW.web.evals.pop()
# anything that isn't ours passes straight through
assert embed._on_message((False, None), "study", None) == (False, None)
print("ready/reload rebuild the slice that is on screen         ok")

print("\nEMBED ASSERTIONS PASSED")
