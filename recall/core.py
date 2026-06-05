"""Shared helpers for both mounts (the window dialog and the home-screen embed):
the web base path, the real-data builder (cached), and the JS bootstrap blob."""
from __future__ import annotations

import json

from aqt import mw

# Render real collection data. If a query fails, compute_raw returns None and
# the web layer falls back to its sample dataset rather than breaking.
USE_REAL_DATA = True

# Cache the computed dataset so we don't rescan the revlog on every deck-browser
# render — only when the collection changes or the data scope (decks/cutoff…) does.
_cache = {"key": None, "raw": None}


def web_base() -> str:
    return f"/_addons/{mw.addonManager.addonFromModule(__name__)}/web"


def _cache_key(cfg):
    try:
        mod = getattr(mw.col, "mod", None)
        if mod is None:
            mod = mw.col.db.scalar("select mod from col")
    except Exception:
        mod = None
    try:
        scope = json.dumps((cfg or {}).get("data"), sort_keys=True)
    except Exception:
        scope = ""
    return (mod, scope)


def compute_raw(cfg, force=False):
    if not USE_REAL_DATA or mw.col is None:
        return None
    key = _cache_key(cfg)
    if not force and _cache["key"] == key and _cache["raw"] is not None:
        return _cache["raw"]
    try:
        from . import data
        raw = data.build_dataset(mw.col, cfg)
    except Exception as e:  # never let a query error take down the UI
        print("Recall: real-data build failed, using sample —", repr(e))
        return None
    _cache["key"] = key
    _cache["raw"] = raw
    return raw


def invalidate_cache():
    _cache["key"] = None
    _cache["raw"] = None


def bootstrap_json(cfg, mode: str) -> str:
    """The window.__RECALL__ blob injected into the page before recall.js."""
    return json.dumps({
        "config": cfg,
        "data": compute_raw(cfg),
        "mode": mode,
        "webBase": web_base(),
    })
