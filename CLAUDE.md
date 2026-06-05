# Recall — Anki Progress · project guide

Strava-style study-progress add-on for **Anki 25.09** (Qt6). One React bundle, two surfaces:
- **Home-screen carousel** ("embed") — injected below the deck-browser heatmap; shows ONE card at a time, navigated by arrows / dots / swipe.
- **Window** — Tools → Recall — Progress (or top-toolbar "Progress"); full scrolling dashboard.

The add-on is **symlinked** into `~/Library/Application Support/Anki2/addons21/recall`, so editing this folder + restarting Anki is the live loop.

---

## ⚠️ Build & reload loop — READ FIRST
The UI is React/JSX in `web-src/src/`, compiled by **esbuild** into `recall/web/recall.js` (CSS + everything bundled into that one file). **Editing `web-src/src/*` has NO effect until you rebuild.**

```bash
cd web-src
npm install      # once
npm run build    # compile  -> ../recall/web/recall.js
npm run watch    # auto-rebuild on every save (use while iterating)
```
Then **restart Anki**. Cache-busting is built in (`core.script_url()` appends `?v=<bundle mtime>`), so the fresh bundle always loads — no stale-cache surprises.

**Preview without Anki** (fast iteration): `node web-src/server.mjs` then open
- `http://localhost:8123/?embed=1` → the carousel
- `http://localhost:8123/` → the window
Uses sample data + localStorage; no real collection needed.

Never hand-edit `recall/web/recall.js` — it's generated.

---

## 🎚️ Where to change the look / size (the usual ask)
All in `web-src/src/` (rebuild after editing):
- **Master carousel size:** `styles.css` → `.embed-inner { zoom: 0.82 }`. Higher = bigger, lower = smaller. **Start here.**
- **Carousel width:** `styles.css` → `.embed { max-width: 680px }`.
- **Per-card element sizes:** the `compact` prop drives smaller rings/numbers/charts. Ternaries live in `cards-core.jsx` (Goals rings & numbers, Activity chart height, Streak calendar cells) and `cards-extra.jsx` (Forecast/Hourly/FSRS/DeckBoard/Records/Achievements). `compact` is `true` only in the carousel, `false` in the window.
- **Compact class-based sizes** (padding, titles, labels, tabs, top bar): the `.embed …` block near the bottom of `styles.css`.
- **Colors / theme tokens:** `:root, :host` blocks in `styles.css` (OKLCH). The carousel overrides neutral surfaces at runtime to match Anki's background — see `applyAnkiSurfaces()` in `embed.jsx`.

Cards are **natural height** (no fixed-height scaler → nothing clips). If a card is too tall it just makes the carousel taller; tune `zoom`/`compact` to shrink it.

---

## File map
```
recall/                  THE ADD-ON (symlinked into addons21/recall)
  __init__.py            Tools menu + toolbar 'Progress' + web exports + embed hooks
  core.py                web_base/script_url (cache-bust), cached real-data builder,
                         bootstrap JSON, USE_REAL_DATA flag
  embed.py               home-screen carousel: deck-browser injection + pycmd bridge
                         + debug log (writes recall/recall.log)
  dialog.py              window mode: AnkiWebView host + pycmd bridge
  config_store.py        settings defaults / load / save  (MIRROR of config.js)
  data.py                real collection queries (revlog / FSRS / decks) -> raw dataset
  web/recall.js          BUILT bundle (committed) · web/fonts/ · web/index.html (dev)
  manifest.json · config.json · config.md
web-src/                 dev source — does NOT ship
  src/main.jsx           entry: picks window vs embed, mounts (embed = Shadow DOM)
  src/app.jsx            window dashboard      src/embed.jsx   carousel
  src/cardmap.jsx        key -> card renderer  src/cards-core.jsx / cards-extra.jsx
  src/charts.jsx         Ring / TrendChart / Bars     src/settings.jsx  gear drawer
  src/data.js            sample data + buildAnki() aggregation
  src/config.js          config load/save + appMode/webBase   src/useRecall.jsx  shared state
  src/icons.jsx · src/styles.css
  build.mjs · server.mjs · test_data.py · package.json
```

## Data
- Real data is ON: `core.USE_REAL_DATA = True`. Any query failure falls back to JS sample data, so the panel never breaks.
- `data.py build_dataset(col, cfg)` → `raw = {today, decks, days[], hourly, forecast, fsrs, records, achievements}`, cached on collection mod-time (so the home screen doesn't rescan every render).
- Aggregation (trend / period / goals / streak / deckBoard) is in **JS** `buildAnki()` (`data.js`), run on the injected `raw`.
- **FSRS** (most sensitive — validate against a real collection): stability/difficulty from `cards.data` JSON (`$.s`/`$.d`), retrievability via forgetting curve with decay −0.5.
- Streak counts back from today; a not-yet-studied today does NOT reset it.
- Offline logic test (no Anki): `python3 web-src/test_data.py` — `data.py` has no `aqt` imports, so a fake collection drives it.

## Settings (gear icon)
Web drawer (`settings.jsx`) → `pycmd("recall:save:<json>")` → `config_store.py` (Anki `config.json`). Controls: section show/hide + order, goals (targets + custom goals), appearance (theme/chart/corners), data (decks / cutoff hour / mature threshold / streak min).
**Keep `config_store.py` DEFAULT_CONFIG and `config.js` DEFAULT_CONFIG in sync.**

## JS ↔ Python bridge
pycmd messages: `recall:save:<json>`, `recall:reload`, `recall:log:<msg>` (debug).
Window → `dialog.set_bridge_command`. Carousel → `gui_hooks.webview_did_receive_js_message` (`embed.py`).

## Pending / TODO
- [ ] Dial in carousel size to taste (`zoom` knob above) — or add a density control in Settings.
- [ ] Add-on lists as "recall" → set a display name so it reads "Recall — Anki Progress".
- [ ] Remove debug logging when done: `embed.py` `_log()` + the inline reporter, and `main.jsx` `report()` (these write `recall/recall.log`).
- [ ] Validate FSRS numbers vs a real collection.

## Git restore points
- `daf29a1` — working add-on BEFORE the compact resize.
- latest commit — compact sizing + cache-bust + streak fix (this handover).
Compare/restore with `git log --oneline`, `git diff <hash>`, or `git checkout <hash> -- <file>`.

## Gotchas
- Webview caches assets aggressively — always version the URL (handled by `core.script_url()`).
- The carousel mounts in a **Shadow DOM** for style isolation; theme tokens are on `:host`; fonts are injected at runtime with an absolute path (`main.jsx`).
- `recall/recall.log` and `recall/meta.json` are git-ignored.
