"""Add-on config: defaults, load, save, migration.

The shape here MUST stay in sync with web-src/src/config.js (DEFAULT_CONFIG).
Anki persists this via config.json + the add-on manager; we deep-merge stored
values over the defaults so new keys appear automatically across upgrades.
"""
from __future__ import annotations

import copy
from typing import Any, Dict

from aqt import mw

CONFIG_VERSION = 1

SECTION_KEYS = [
    "goals", "activity", "streak", "forecast", "answerButtons",
    "hourly", "fsrs", "deckBoard", "records", "achievements",
]

DEFAULT_CONFIG: Dict[str, Any] = {
    "version": CONFIG_VERSION,
    "appearance": {"theme": "strava", "chart": "area", "corners": "round"},
    "sections": {"order": list(SECTION_KEYS), "hidden": []},
    "goals": [
        {"key": "cards", "label": "Cards", "icon": "layers", "source": "total", "unit": "count", "weeklyTarget": 1200},
        {"key": "time", "label": "Study Time", "icon": "clock", "source": "time", "unit": "time", "weeklyTarget": 25200},
        {"key": "new", "label": "New Cards", "icon": "plus", "source": "newC", "unit": "count", "weeklyTarget": 120},
        {"key": "days", "label": "Days Studied", "icon": "check", "source": "daysStudied", "unit": "days", "weeklyTarget": 7},
    ],
    "data": {
        "includeDecks": [],         # [] = all decks
        "cutoffHour": None,         # None = use Anki's rollover hour
        "matureThresholdDays": 21,
        "streakMinCards": 1,
    },
}


def _is_obj(x: Any) -> bool:
    return isinstance(x, dict)


def _deep_merge(base: Any, over: Any) -> Any:
    """Recursively merge dicts; non-dict values (incl. lists) from `over` win."""
    if not _is_obj(base):
        return base if over is None else over
    out = copy.deepcopy(base)
    if not _is_obj(over):
        return out
    for k, v in over.items():
        out[k] = _deep_merge(base[k], v) if (_is_obj(base.get(k)) and _is_obj(v)) else copy.deepcopy(v)
    return out


def _normalize_sections(cfg: Dict[str, Any]) -> None:
    """Union stored order with any newly-added section keys; drop unknowns."""
    sec = cfg.setdefault("sections", {})
    order = [k for k in sec.get("order", []) if k in SECTION_KEYS]
    for k in SECTION_KEYS:
        if k not in order:
            order.append(k)
    sec["order"] = order
    sec["hidden"] = [k for k in sec.get("hidden", []) if k in SECTION_KEYS]


def get_config() -> Dict[str, Any]:
    stored = mw.addonManager.getConfig(__name__) or {}
    cfg = _deep_merge(DEFAULT_CONFIG, stored)
    _normalize_sections(cfg)
    cfg["version"] = CONFIG_VERSION
    return cfg


def save_config(cfg: Dict[str, Any]) -> None:
    merged = _deep_merge(DEFAULT_CONFIG, cfg or {})
    _normalize_sections(merged)
    merged["version"] = CONFIG_VERSION
    mw.addonManager.writeConfig(__name__, merged)
