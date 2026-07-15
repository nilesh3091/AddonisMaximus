"""Addonis Maximus — Anki Progress.

A Strava-style study dashboard rendered in an AnkiWebView, with a settings
panel (gear icon) for goals, card visibility, appearance, and data scope.
"""
from __future__ import annotations

from aqt import mw

# Allow the webview to load our bundled assets (addonismaximus.js / addonismaximus.css / fonts).
mw.addonManager.setWebExports(__name__, r"web/.*")

# The home-screen carousel (injected below the deck-browser heatmap) is the
# add-on's only surface. The standalone window in dialog.py is intentionally not
# launched from any menu/toolbar entry point.
from . import embed  # noqa: E402
embed.register()
