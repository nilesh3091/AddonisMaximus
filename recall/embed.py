"""Home-screen embed: inject the Recall carousel into the deck browser (below
the heatmap etc.) and bridge its settings/reload messages.

The web app renders in 'embed' mode (a carousel inside a shadow root, so its
styles never touch Anki's page). Messages from the main webview are handled via
the global webview_did_receive_js_message hook.

Diagnostics: the full lifecycle (hook fired, JS bootstrap, mount, errors) is
written to recall/recall.log so failures can be inspected without a live console.
"""
from __future__ import annotations

import json
import os
import time

from aqt import mw, gui_hooks

from . import core, config_store

_LOG = os.path.join(os.path.dirname(__file__), "recall.log")


def _log(msg: str) -> None:
    try:
        with open(_LOG, "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%H:%M:%S')} {msg}\n")
    except Exception:
        pass


def _on_will_render(deck_browser, content) -> None:
    try:
        cfg = config_store.get_config()
        base = core.web_base()
        boot = core.bootstrap_json(cfg, "embed")
        # Inline bootstrap reports its own lifecycle back to Python via pycmd so
        # we can see, from the log, exactly how far loading got.
        reporter = (
            "window.addEventListener('error',function(e){try{pycmd('recall:log:jserror '"
            "+(e.message||'')+' @'+(e.filename||'')+':'+(e.lineno||''));}catch(_){}});"
            "try{pycmd('recall:log:bootstrap mode='+(window.__RECALL__&&window.__RECALL__.mode));}catch(_){}"
        )
        content.stats += (
            '<div id="recall-embed"></div>'
            f"<script>window.__RECALL__ = {boot};{reporter}</script>"
            f"<script src=\"{core.script_url()}\" onerror=\"try{{pycmd('recall:log:script-load-failed')}}catch(e){{}}\"></script>"
        )
        _log(f"will_render fired; web_base={base}; bootstrap_bytes={len(boot)}")
    except Exception as e:
        import traceback
        _log("will_render EXCEPTION: " + traceback.format_exc())
        print("Recall: embed render failed —", repr(e))


def _on_message(handled, message, context):
    if not isinstance(message, str) or not message.startswith("recall:"):
        return handled
    # The standalone dialog has its own bridge; let those messages pass through.
    try:
        from .dialog import RecallDialog
        if isinstance(context, RecallDialog):
            return handled
    except Exception:
        pass

    if message.startswith("recall:log:"):
        _log("JS: " + message[len("recall:log:"):])
        return (True, None)

    if message.startswith("recall:save:"):
        try:
            config_store.save_config(json.loads(message[len("recall:save:"):]))
        except Exception as e:
            print("Recall: save failed —", repr(e))
        return (True, None)

    if message == "recall:reload":
        raw = core.compute_raw(config_store.get_config(), force=True)
        if raw is not None and mw.web is not None:
            mw.web.eval(f"window.recallSetData && window.recallSetData({json.dumps(raw)});")
        return (True, None)

    return handled


def register() -> None:
    try:
        with open(_LOG, "w", encoding="utf-8") as f:
            f.write(f"{time.strftime('%H:%M:%S')} register() called — Recall embed armed\n")
    except Exception:
        pass
    gui_hooks.deck_browser_will_render_content.append(_on_will_render)
    gui_hooks.webview_did_receive_js_message.append(_on_message)
