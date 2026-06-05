"""Recall — Anki Progress.

A Strava-style study dashboard rendered in an AnkiWebView, with a settings
panel (gear icon) for goals, card visibility, appearance, and data scope.
"""
from __future__ import annotations

from aqt import mw, gui_hooks
from aqt.qt import QAction, qconnect

# Allow the webview to load our bundled assets (recall.js / recall.css / fonts).
mw.addonManager.setWebExports(__name__, r"web/.*")


def _open() -> None:
    from . import dialog
    dialog.open_dialog()


def _add_menu_item() -> None:
    action = QAction("Recall — Progress", mw)
    qconnect(action.triggered, _open)
    mw.form.menuTools.addAction(action)


def _add_toolbar_link(links, toolbar) -> None:
    links.append(
        toolbar.create_link(
            cmd="recall_progress",
            label="Progress",
            func=_open,
            tip="Recall — your study progress",
            id="recall_progress",
        )
    )


_add_menu_item()
gui_hooks.top_toolbar_did_init_links.append(_add_toolbar_link)

# Embed the carousel on the home screen (deck browser).
from . import embed  # noqa: E402
embed.register()
