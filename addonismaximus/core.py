"""Shared helpers for both mounts (the window dialog and the home-screen embed):
the web base path, the cached/background dataset builder, and the JS bootstrap blob.

The dataset is NEVER built on the Qt main thread. Render hooks call cached_raw()
(cheap, no revlog access) and, when it comes back empty, start_build() — which
hands the work to a QueryOp and pushes the result into the webview when it lands."""
from __future__ import annotations

import json
import os

from aqt import mw

# Render real collection data. When a build fails the dataset comes back None and
# bootstrap_json reports dataState "unavailable" — only then does the web layer
# fall back to its sample dataset.
USE_REAL_DATA = True

# Cache the computed dataset so we don't rescan the revlog on every deck-browser
# render — only when the collection changes or the data scope (decks/cutoff…) does.
_cache = {"key": None, "raw": None}

# The only config["data"] keys build_dataset reads (data.py). streakMinCards is
# applied entirely in the JS layer, so keying the cache on it would throw away a
# perfectly good dataset and force a full rescan for an identical result.
_PY_DATA_KEYS = ("includeDecks", "cutoffHour", "matureThresholdDays", "excludeSuspended")

# One background build at a time. `key` is the cache key it is building for;
# `waiters` are callbacks queued while it runs.
_build = {"key": None, "waiters": []}


def web_base() -> str:
    return f"/_addons/{mw.addonManager.addonFromModule(__name__)}/web"


def bundle_version() -> int:
    """mtime of the built bundle — used as a ?v= cache-buster so the webview
    never serves a stale addonismaximus.js after a rebuild/update."""
    try:
        return int(os.path.getmtime(os.path.join(os.path.dirname(__file__), "web", "addonismaximus.js")))
    except Exception:
        return 0


def script_url() -> str:
    return f"{web_base()}/addonismaximus.js?v={bundle_version()}"


def wants_projection(cfg) -> bool:
    """Is the Maturity ETA card actually on screen?

    _projection is the single most expensive part of build_dataset — a full-table
    revlog scan plus every card's state — and it feeds only that one card, which
    ships hidden (see config_store.DEFAULT_VISIBLE). Skipping it when nobody is
    looking roughly halves the build. It counts as visible if it is an enabled
    carousel card OR if a multi-mode block slot holds it; anything unreadable
    falls back to True, so a config we don't understand loses speed, not data.
    """
    try:
        cfg = cfg or {}
        hidden = ((cfg.get("sections") or {}).get("hidden")) or []
        if "maturity" not in hidden:
            return True
        blocks = ((cfg.get("appearance") or {}).get("blocks")) or []
        return "maturity" in blocks
    except Exception:
        return True


def _cache_key(cfg):
    try:
        mod = getattr(mw.col, "mod", None)
        if mod is None:
            mod = mw.col.db.scalar("select mod from col")
    except Exception:
        mod = None
    try:
        d = (cfg or {}).get("data") or {}
        scope = json.dumps({k: d.get(k) for k in _PY_DATA_KEYS}, sort_keys=True)
    except Exception:
        scope = ""
    # The day rollover writes nothing to the collection — sched.today and
    # day_cutoff are derived from the collection's creation time plus the wall
    # clock — so `mod` is identical either side of it. Without the day in the
    # key, a blob built yesterday keeps being served on any re-render that
    # happens with no collection write in between (clicking Decks in the
    # morning, pressing "d"), and the panel renders yesterday: the "Today" halo
    # sits on the wrong cell and Forecast day 0 is yesterday's due set, right
    # beside Anki's own freshly-counted deck rows.
    try:
        day = mw.col.sched.today
    except Exception:
        day = None
    # A dataset built with the projection skipped carries projection == [], so
    # turning the Maturity card on has to miss the cache and rebuild rather than
    # render "Not enough history yet" forever. The web layer mirrors this in its
    # reload trigger (useAddonisMaximus.jsx), so enabling the card asks for the
    # rebuild instead of waiting for the next collection write.
    return (mod, scope, day, wants_projection(cfg))


def _refresh_pending(raw, cfg) -> None:
    """"Pending today" is clock-sensitive: cards fall due and daily limits reset at
    rollover with no DB write, so the mod-time cache would serve it stale. Refresh
    just this section — it reads the scheduler's due tree, which Anki has already
    computed to draw the deck list beside us."""
    try:
        from . import data
        raw["pending"] = data._pending(mw.col, data._deck_filter_dids(mw.col, cfg))
    except Exception as e:
        print("Addonis Maximus: pending refresh failed —", repr(e))


def cached_raw(cfg):
    """The dataset if a current one is already in hand, else None. Never queries
    the revlog, so it is safe to call from the deck-browser render hook."""
    if not USE_REAL_DATA or mw.col is None:
        return None
    if _cache["raw"] is None or _cache["key"] != _cache_key(cfg):
        return None
    _refresh_pending(_cache["raw"], cfg)
    return _cache["raw"]


def start_build(cfg, deliver=None, force=False) -> None:
    """Build the dataset on Anki's worker thread and hand it to `deliver`.

    build_dataset walks a three-year revlog window and (when the Maturity card is
    on) the whole card table: 2.0s at 400k revlog rows and 4.4s at 1.2M, measured.
    Running that inside deck_browser_will_render_content froze Anki's home screen
    for exactly that long, every time you came back from studying, because
    _cache_key includes col.mod and every write bumps it.

    QueryOp is the supported way off the main thread: it runs op(col) on the
    background thread with `uses_collection=True`, so it serialises against
    Anki's own collection ops instead of racing them the way a raw
    taskman.run_in_background over col.db.all would. No .with_progress() — a
    modal spinner over the deck list would be worse than the wait it replaces;
    the panel shows its own inline placeholder until `deliver` fires.

    Single-flight: a second caller for the same cache key joins the running
    build rather than starting a rival scan. `deliver` is always called on the
    main thread, with the dataset or with None if the build failed.
    """
    if not USE_REAL_DATA or mw.col is None:
        if deliver:
            deliver(None)
        return

    key = _cache_key(cfg)
    if not force and _cache["key"] == key and _cache["raw"] is not None:
        _refresh_pending(_cache["raw"], cfg)
        if deliver:
            deliver(_cache["raw"])
        return

    if _build["key"] == key:            # already running for this exact scope
        if deliver:
            _build["waiters"].append(deliver)
        return

    # This build owns `waiters`. While it is the current build, _build["waiters"]
    # IS that list, so joiners land in it; once a later start_build for a
    # different key supersedes us, _build points at a fresh list and ours is
    # closed. Holding the list rather than reading _build back at completion is
    # what keeps a superseded build from clearing its successor's bookkeeping and
    # stranding the newer render on the placeholder forever.
    waiters = [deliver] if deliver else []
    _build["key"] = key
    _build["waiters"] = waiters
    want_proj = wants_projection(cfg)

    def op(col):
        from . import data
        return data.build_dataset(col, cfg, want_projection=want_proj)

    def finish(raw):
        if _build["waiters"] is waiters:      # still the current build
            _build["key"], _build["waiters"] = None, []
        if raw is not None:
            _cache["key"], _cache["raw"] = key, raw
            _refresh_pending(raw, cfg)
        for cb in waiters:
            try:
                cb(raw)
            except Exception as e:
                print("Addonis Maximus: dataset delivery failed —", repr(e))

    def failed(exc):
        # Never let a query error take down the deck browser, and never surface
        # Anki's exception dialog for a stats panel: log it and tell the waiters
        # so they can stop showing a placeholder that will never resolve.
        print("Addonis Maximus: real-data build failed —", repr(exc))
        finish(None)

    try:
        from aqt.operations import QueryOp
        QueryOp(parent=mw, op=op, success=finish).failure(failed).run_in_background()
    except Exception as e:
        failed(e)


def invalidate_cache():
    _cache["key"] = None
    _cache["raw"] = None


def bootstrap_json(cfg, mode: str, raw) -> str:
    """The window.__ADDONISMAXIMUS__ blob injected into the page before addonismaximus.js.

    `dataState` tells the web layer which of three situations it is in, because
    a null dataset alone is ambiguous and the old code resolved it the worst
    possible way — by rendering the JS *sample* collection, i.e. invented numbers
    presented as the user's own stats:
      "ready"       — `data` is this collection's real dataset.
      "loading"     — a background build is running; show a placeholder and wait
                      for window.addonismaximusSetData.
      "unavailable" — real data is off or there is no collection open (the dev
                      preview never gets here: it has no bootstrap blob at all,
                      so it still falls back to sample data).
    """
    if raw is not None:
        state = "ready"
    elif USE_REAL_DATA and mw.col is not None:
        state = "loading"
    else:
        state = "unavailable"
    return json.dumps({
        "config": cfg,
        "data": raw,
        "dataState": state,
        "mode": mode,
        "webBase": web_base(),
    })
