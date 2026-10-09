"""Embedded panels: inject the Addonis Maximus carousel into the deck browser (below
the heatmap etc.) and into the deck overview screen, and bridge their
settings/reload messages.

The web app renders in 'embed' mode (a carousel inside a shadow root, so its
styles never touch Anki's page). Messages from the main webview are handled via
the global webview_did_receive_js_message hook.

Both mounts are the same panel over a different slice of the collection: the deck
browser shows the whole collection (honouring the settings deck filter), the deck
overview shows only the deck you opened and its subdecks. The slice is carried as
a `deck_id` all the way down to data.build_dataset, and datasets for the two are
cached separately (core._cache), so walking Decks -> deck -> Decks doesn't rebuild
either one.
"""
from __future__ import annotations

import json

from aqt import mw, gui_hooks

from . import core, config_store


def _open_deck_id():
    """The deck Anki currently has selected, or None if it can't be read."""
    try:
        return int(mw.col.decks.get_current_id())
    except Exception:
        return None


def _current_deck_id():
    """The slice the screen on display is showing: the open deck on the overview,
    None (whole collection) anywhere else. Read at the moment it is needed — a
    bridge message can only have come from the page currently on screen."""
    return _open_deck_id() if mw.state == "overview" else None


def _push_data(raw, deck_id=None) -> None:
    """Hand a freshly built dataset to the panel, if it is still on screen.

    The deck browser, the deck overview and the reviewer all share mw.web, so by
    the time a build finishes the page may have been replaced — hence the guards.
    `addonismaximusSetData` simply doesn't exist on any other screen, and the
    scopeKey check catches the case that does exist but is the *wrong* slice:
    open a deck, walk back to Decks before its build lands, and without it the
    deck's numbers would repaint the whole-collection panel. A None dataset (the
    build failed) is passed through as null so the panel stops waiting and falls
    back rather than showing a placeholder for the rest of the session.
    """
    if mw.web is None:
        return
    payload = "null" if raw is None else json.dumps(raw)
    want = json.dumps(core.scope_key(deck_id))
    mw.web.eval(
        "(function(b){ if (b && b.scope && b.scope.scopeKey !== " + want + ") return;"
        f" window.addonismaximusSetData && window.addonismaximusSetData({payload});"
        "})(window.__ADDONISMAXIMUS__);"
    )


def _boot_blob(cfg, deck_id) -> str:
    """The window.__ADDONISMAXIMUS__ payload for a mount, starting the background
    build if this slice isn't already cached.

    cached_raw never touches the revlog, so this stays cheap no matter how big the
    collection is. When there is nothing cached — first render of the session, or
    anything at all was written to the collection since the last one, which is
    every single return from studying — the panel boots in its "loading" state
    and start_build fills it in off-thread.
    """
    raw = core.cached_raw(cfg, deck_id)
    boot = core.bootstrap_json(cfg, "embed", raw, deck_id)
    if raw is None:
        core.start_build(cfg, lambda r: _push_data(r, deck_id), deck_id=deck_id)
    return boot


def _panel_html(cfg, deck_id) -> str:
    """The host div + bootstrap blob + bundle tag, for either mount."""
    boot = _boot_blob(cfg, deck_id)
    return (
        '<div id="addonismaximus-embed"></div>'
        f"<script>window.__ADDONISMAXIMUS__ = {boot};</script>"
        f"<script src=\"{core.script_url()}\"></script>"
    )


def _on_will_render(deck_browser, content) -> None:
    try:
        content.stats += _panel_html(config_store.get_config(), None)
    except Exception as e:
        print("Addonis Maximus: embed render failed —", repr(e))


def _on_overview_render(overview, content) -> None:
    """The same panel on a deck's overview screen, scoped to that deck.

    It goes after the counts table, which is the last thing in the page body, so
    the panel lands under "Study Now" the way the Review Heatmap add-on's
    calendar does. Anki builds the page with `_body % content.__dict__`, and %
    formatting does not rescan substituted values, so the bundle's markup is safe
    here.

    A deck with nothing left today never reaches this hook — Anki shows its
    congrats page instead, which _on_congrats_page covers.
    """
    try:
        content.table += _panel_html(config_store.get_config(), _open_deck_id())
    except Exception as e:
        print("Addonis Maximus: overview render failed —", repr(e))


def _on_congrats_page(webview) -> None:
    """The same panel on the congrats screen — the deck overview a *finished*
    deck shows instead.

    That screen is a SvelteKit page loaded by URL, so it has no content hook to
    append to; this one fires after Anki has styled a loaded page, and we build
    the same three tags by hand. It is the only page this can be: stdHtml pages
    (the deck browser, the ordinary overview) never reach it, and mw.state pins
    the rest to the deck being open — the id check is belt-and-braces so the
    panel can never be mounted twice.
    """
    try:
        if mw.web is None or webview is not mw.web or mw.state != "overview":
            return
        deck_id = _open_deck_id()
        boot = _boot_blob(config_store.get_config(), deck_id)
        webview.eval(
            "(function(){"
            "  if (document.getElementById('addonismaximus-embed')) return;"
            f" window.__ADDONISMAXIMUS__ = {boot};"
            "  var d = document.createElement('div');"
            "  d.id = 'addonismaximus-embed';"
            "  d.style.cssText = 'padding:8px 12px 24px';"
            "  document.body.appendChild(d);"
            "  var s = document.createElement('script');"
            f" s.src = {json.dumps(core.script_url())};"
            "  document.body.appendChild(s);"
            "})();"
        )
    except Exception as e:
        print("Addonis Maximus: congrats render failed —", repr(e))


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
        deck_id = _current_deck_id()
        core.start_build(config_store.get_config(), lambda r: _push_data(r, deck_id),
                         deck_id=deck_id)
        return (True, None)

    if message == "addonismaximus:reload":
        # Also off the main thread: this fires from the settings drawer when the
        # data scope changes, and it is the same full rebuild the render hook does.
        deck_id = _current_deck_id()
        core.start_build(config_store.get_config(), lambda r: _push_data(r, deck_id),
                         force=True, deck_id=deck_id)
        return (True, None)

    return handled


def register() -> None:
    gui_hooks.deck_browser_will_render_content.append(_on_will_render)
    gui_hooks.overview_will_render_content.append(_on_overview_render)
    gui_hooks.webview_did_inject_style_into_page.append(_on_congrats_page)
    gui_hooks.webview_did_receive_js_message.append(_on_message)
