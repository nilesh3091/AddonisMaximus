"""The standalone Addonis Maximus progress window: an AnkiWebView hosting the bundled web
app in 'window' mode, with a JS<->Python bridge for settings + data reload."""
from __future__ import annotations

import json

from aqt import mw
from aqt.qt import QDialog, QVBoxLayout, qconnect
from aqt.webview import AnkiWebView

from . import core, config_store

_dialog = None  # singleton


class AddonisMaximusDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent or mw)
        self.setWindowTitle("Addonis Maximus")
        self.setObjectName("AddonisMaximusProgressDialog")
        self.resize(760, 940)
        self.setMinimumSize(420, 560)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        self.web = AnkiWebView(parent=self)
        self.web.set_bridge_command(self._on_bridge_cmd, self)
        layout.addWidget(self.web)
        qconnect(self.finished, lambda _: self.web.cleanup())

        self._render()

    def _render(self) -> None:
        cfg = config_store.get_config()
        body = (
            '<div id="root"></div>'
            f"<script>window.__ADDONISMAXIMUS__ = {core.bootstrap_json(cfg, 'window')};</script>"
            f'<script src="{core.script_url()}"></script>'
        )
        self.web.stdHtml(body, css=[], js=[], default_css=False, context=self)

    def _on_bridge_cmd(self, cmd: str):
        if cmd.startswith("addonismaximus:save:"):
            try:
                config_store.save_config(json.loads(cmd[len("addonismaximus:save:"):]))
            except Exception as e:
                print("Addonis Maximus: save failed —", repr(e))
            return None
        if cmd == "addonismaximus:reload":
            raw = core.compute_raw(config_store.get_config(), force=True)
            if raw is not None:
                self.web.eval(f"window.addonismaximusSetData && window.addonismaximusSetData({json.dumps(raw)});")
            return None
        return self.web.defaultOnBridgeCmd(cmd)


def open_dialog() -> None:
    global _dialog
    if mw.col is None:
        return
    if _dialog is None:
        _dialog = AddonisMaximusDialog(mw)

        def _cleared(_):
            global _dialog
            _dialog = None

        qconnect(_dialog.finished, _cleared)
    _dialog.show()
    _dialog.raise_()
    _dialog.activateWindow()
