"""Home-screen embed: inject the Addonis Maximus carousel into the deck browser (below
the heatmap etc.) and bridge its settings/reload messages.

The web app renders in 'embed' mode (a carousel inside a shadow root, so its
styles never touch Anki's page). Messages from the main webview are handled via
the global webview_did_receive_js_message hook.
"""
from __future__ import annotations

import json

from aqt import mw, gui_hooks

from . import core, config_store


def _on_will_render(deck_browser, content) -> None:
    try:
        cfg = config_store.get_config()
        boot = core.bootstrap_json(cfg, "embed")
        content.stats += (
            '<div id="addonismaximus-embed"></div>'
            f"<script>window.__ADDONISMAXIMUS__ = {boot};</script>"
            f"<script src=\"{core.script_url()}\"></script>"
        )
    except Exception as e:
        print("Addonis Maximus: embed render failed —", repr(e))


def _on_message(handled, message, context):
    if not isinstance(message, str) or not message.startswith("addonismaximus:"):
        return handled
    # The standalone dialog has its own bridge; let those messages pass through.
    try:
        from .dialog import AddonisMaximusDialog
        if isinstance(context, AddonisMaximusDialog):
            return handled
    except Exception:
        pass

    if message.startswith("addonismaximus:save:"):
        try:
            config_store.save_config(json.loads(message[len("addonismaximus:save:"):]))
        except Exception as e:
            print("Addonis Maximus: save failed —", repr(e))
        return (True, None)

    if message == "addonismaximus:reload":
        raw = core.compute_raw(config_store.get_config(), force=True)
        if raw is not None and mw.web is not None:
            mw.web.eval(f"window.addonismaximusSetData && window.addonismaximusSetData({json.dumps(raw)});")
        return (True, None)

    return handled


def register() -> None:
    gui_hooks.deck_browser_will_render_content.append(_on_will_render)
    gui_hooks.webview_did_receive_js_message.append(_on_message)
