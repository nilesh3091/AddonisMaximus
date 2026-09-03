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


def _push_data(raw) -> None:
    """Hand a freshly built dataset to the carousel, if it is still on screen.

    The deck browser and the reviewer share mw.web, so by the time a build
    finishes the page may have been replaced — hence the `&&` guard: on any
    other screen addonismaximusSetData simply doesn't exist and the eval is a
    no-op. A None dataset (the build failed) is passed through as null so the
    panel stops waiting and falls back rather than showing a placeholder for
    the rest of the session.
    """
    if mw.web is None:
        return
    payload = "null" if raw is None else json.dumps(raw)
    mw.web.eval(f"window.addonismaximusSetData && window.addonismaximusSetData({payload});")


def _on_will_render(deck_browser, content) -> None:
    try:
        cfg = config_store.get_config()
        # cached_raw never touches the revlog, so this hook stays cheap no matter
        # how big the collection is. When there is nothing cached — first render
        # of the session, or anything at all was written to the collection since
        # the last one, which is every single return from studying — the panel
        # boots in its "loading" state and start_build fills it in off-thread.
        raw = core.cached_raw(cfg)
        boot = core.bootstrap_json(cfg, "embed", raw)
        content.stats += (
            '<div id="addonismaximus-embed"></div>'
            f"<script>window.__ADDONISMAXIMUS__ = {boot};</script>"
            f"<script src=\"{core.script_url()}\"></script>"
        )
        if raw is None:
            core.start_build(cfg, _push_data)
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

    if message.startswith("addonismaximus:save_image:"):
        try:
            import base64
            import os
            from datetime import datetime
            from pathlib import Path
            from aqt.qt import QFileDialog
            from aqt.utils import showInfo
            data_uri = message[len("addonismaximus:save_image:"):]
            if "," in data_uri:
                data = data_uri.split(",", 1)[1]
                img_data = base64.b64decode(data)
                
                downloads_dir = str(Path.home() / "Downloads")
                timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
                default_path = os.path.join(downloads_dir, f"ankstats_share_{timestamp}.png")
                
                # Since embed handles this via main window, parent is mw
                path, _ = QFileDialog.getSaveFileName(mw, "Save Share Image", default_path, "Images (*.png)")
                if path:
                    with open(path, "wb") as f:
                        f.write(img_data)
                    showInfo("Image saved successfully.")
        except Exception as e:
            print("Addonis Maximus: save_image failed —", repr(e))
        return (True, None)

    if message == "addonismaximus:ready":
        # The page booted in its "loading" state. Serve it from the cache, or
        # join the build the render hook already started — start_build is
        # idempotent per cache key, so this never costs a second scan. Without
        # it, a build that finishes before the new page is committed pushes into
        # the outgoing document and the panel waits forever.
        core.start_build(config_store.get_config(), _push_data)
        return (True, None)

    if message == "addonismaximus:reload":
        # Also off the main thread: this fires from the settings drawer when the
        # data scope changes, and it is the same full rebuild the render hook does.
        core.start_build(config_store.get_config(), _push_data, force=True)
        return (True, None)

    return handled


def register() -> None:
    gui_hooks.deck_browser_will_render_content.append(_on_will_render)
    gui_hooks.webview_did_receive_js_message.append(_on_message)
