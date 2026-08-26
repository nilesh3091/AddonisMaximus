# Addonis Maximus · project guide

Strava-style study-progress add-on for **Anki 25.09** (Qt6). One React bundle. The only surface is the **home-screen carousel** ("embed") — injected below the deck-browser heatmap; shows ONE card at a time, navigated by arrows / dots / swipe.

The full-dashboard **window** (`dialog.py`) still exists in code but is **not launched** — its Tools-menu item and top-toolbar "Progress" link were removed. It can still be previewed offline (see below) or re-wired to an entry point later.

The add-on is **symlinked** into `~/Library/Application Support/Anki2/addons21/addonismaximus`, so editing this folder + restarting Anki is the live loop.

---

## ⚠️ Build & reload loop — READ FIRST
The UI is React/JSX in `dev/web-src/src/`, compiled by **esbuild** into `addonismaximus/web/addonismaximus.js` (CSS + everything bundled into that one file). **Editing `dev/web-src/src/*` has NO effect until you rebuild.**

```bash
cd dev/web-src
npm install      # once
npm run build    # compile  -> ../../addonismaximus/web/addonismaximus.js
npm run watch    # auto-rebuild on every save (use while iterating)
```
Then **restart Anki**. Cache-busting is built in (`core.script_url()` appends `?v=<bundle mtime>`), so the fresh bundle always loads — no stale-cache surprises.

**Preview without Anki** (fast iteration): `node dev/web-src/server.mjs` then open
- `http://localhost:8123/?embed=1` → the carousel
- `http://localhost:8123/` → the window
Uses sample data + localStorage; no real collection needed.

Never hand-edit `addonismaximus/web/addonismaximus.js` — it's generated.

---

## 🎚️ Where to change the look / size (the usual ask)
All in `dev/web-src/src/` (rebuild after editing):
- **Master carousel size:** `styles.css` → `.embed-inner { zoom: var(--embed-zoom, 0.656) }`. The `0.656` base is the default; change it to re-baseline everyone. Higher = bigger, lower = smaller. **Start here.**
- **User-facing size control:** Settings → Appearance → **Text size** (`appearance.textScale`, default 1). `embed.jsx` sets `--embed-zoom = 0.656 × textScale` **in render**, as an inline style on `.embed-inner` (not poked onto the host in an effect) — so a new zoom is committed before the cards' layout effects measure their column; set after paint, anything that sizes itself from a measurement (the heat-map) stays laid out for the previous text size. It scales fonts, rings, charts and spacing together. Presets live in `TEXT_SIZES` (`settings.jsx`); keep `textScale` in `config.js` **and** `config_store.py` defaults in sync.
- **Carousel width:** `styles.css` → `.embed { max-width: 680px }`.
- **Carousel height:** Settings → Appearance → **Card height** (`appearance.stageHeight`, default `320`, presets in `CARD_HEIGHTS` in `settings.jsx`) → `--embed-stage-h`. Single mode only. Keep `stageHeight` in `config.js` **and** `config_store.py` in sync.
- **Year heat-map:** responsive by construction — `computeHeatmap` (`cards-core.jsx`) solves the cell size from the measured column so the calendar always fills it; the `box` a caller passes is the *ceiling*, `HEAT_MIN_BOX` (7) the floor, and only below that floor does it drop the oldest month. The window is `HEAT_MONTHS` (11) trailing months plus a month-wide empty buffer (`HEAT_BUF_COLS`) after the newest one, so today never sits against the right edge — the buffer is paid for out of history, and it scales with the cells because it is costed in columns, not pixels. The measured wrapper carries `contain: inline-size` — load-bearing, since the window's card column is a content-sized grid track and the calendar would otherwise feed its own width back into it. Hover/tap a day for a tooltip (Today / Best day badge · date · cards · time · retention) drawn by `HeatCalendar`, shared by the Streak card and the heat-map panel; today's cell gets a pulsing accent halo from `.heat-today` in `styles.css` (drawn on `::after` so it layers over the hover/pinned/best-day rings instead of fighting them).
- **Per-card element sizes:** the `compact` prop drives smaller rings/numbers/charts. Ternaries live in `cards-core.jsx` (Goals rings & numbers, Activity chart height, Streak calendar cells) and `cards-extra.jsx` (Forecast/Hourly/FSRS/DeckBoard/Records/Achievements). `compact` is `true` only in the carousel, `false` in the window.
- **Compact class-based sizes** (padding, titles, labels, tabs, top bar): the `.embed …` block near the bottom of `styles.css`.
- **Colors / theme tokens:** `:root, :host` blocks in `styles.css` (OKLCH). The carousel overrides neutral surfaces at runtime to match Anki's background — see `applyAnkiSurfaces()` in `embed.jsx`.

**Single-mode** cards are **fixed height**: `.embed-stage { height: var(--embed-stage-h) }` with `.embed .card { height: 100%; overflow: hidden }` — so flipping cards never resizes the page, but anything past that height (pre-zoom units) is **clipped**. Design carousel cards to fit; use width (multi-column layouts) instead of stacking tall. Window mode and multi mode are natural height.

---

## 🔀 View modes (`appearance.viewMode`)
The carousel host renders one of two things (`embed.jsx`):
- **`"multi"`** (default) — no carousel. `MultiView` (`cards-core.jsx`) stacks **three blocks**: goal rings → trend graph → 12-month heat-map, each a `.dash-band`, panel at natural height.
- **`"single"`** — the swipe carousel: one enabled section at a time, arrows / dots / swipe, fixed stage height.

Blocks are rendered by key through `renderBlock(key, ctx)` and `MultiView` takes the list as a `blocks` prop (default `MULTI_BLOCKS`), fed from **`appearance.blocks`** — three *card* keys, one per slot. Each band carries a **pencil in its top-right** (`BlockPicker`) whose menu is the whole `SECTIONS` library; picking a card that already holds another slot swaps the two. `goals` / `activity` / `streak` have chrome-less block renderings (rings, trend graph, heat-map); every other key falls back to its full card via the `renderAny` prop — `embed.jsx` passes `renderCard`, because importing cardmap from cards-core would be a cycle. `.dash-band > .card` strips the nested card's frame and keeps its header clear of the pencil.

Blocks reuse the card internals rather than copying them: `GoalRings` is shared with `GoalsCard`, and `HeatmapPanel` is shared with `OverviewCard` (`showHeader={false}` in multi, since the streak sits in the panel header).

## File map
```
addonismaximus/        THE ADD-ON (symlinked into addons21/addonismaximus) — ZIP ITS CONTENTS TO PUBLISH
  __init__.py            web exports + embed.register()  (carousel only — no menu/toolbar)
  core.py                web_base/script_url (cache-bust), cached real-data builder,
                         bootstrap JSON, USE_REAL_DATA flag
  embed.py               home-screen carousel: deck-browser injection + pycmd bridge
                         + debug log (writes addonismaximus/addonismaximus.log)
  dialog.py              window mode (retained, NOT launched): AnkiWebView host + bridge
  config_store.py        settings defaults / load / save  (MIRROR of config.js)
  data.py                real collection queries (revlog / FSRS / decks) -> raw dataset
  web/addonismaximus.js  BUILT bundle (committed) · web/fonts/ · web/index.html (dev only)
  manifest.json · config.json · config.md
  meta.json              ⚠ Anki-generated user config — git-ignored, NEVER upload
dev/                     NOT shipped — nothing under dev/ goes in the upload zip
  web-src/               dev source for the web layer (esbuild -> addonismaximus/web/addonismaximus.js)
  src/main.jsx           entry: picks window vs embed, mounts (embed = Shadow DOM)
  src/app.jsx            window dashboard      src/embed.jsx   carousel
  src/cardmap.jsx        key -> card renderer  src/cards-core.jsx / cards-extra.jsx
  src/charts.jsx         Ring / TrendChart / Bars     src/settings.jsx  gear drawer
  src/data.js            sample data + buildAnki() aggregation
  src/config.js          config load/save + appMode/webBase   src/useAddonisMaximus.jsx  shared state
  src/icons.jsx · src/styles.css
  web-src/build.mjs · web-src/server.mjs · web-src/test_data.py · web-src/package.json
  design_handoff_anki_progress/   original design artifacts (reference only)
  README.md              project readme
```

## Data
- Real data is ON: `core.USE_REAL_DATA = True`. Any query failure falls back to JS sample data, so the panel never breaks.
- `data.py build_dataset(col, cfg)` → `raw = {today, dayCutoff, decks, allDecks, days[], hourly, forecast, projection, pending}`, cached on collection mod-time (so the home screen doesn't rescan every render).
- Aggregation (trend / period / goals / streak / deckBoard) is in **JS** `buildAnki()` (`data.js`), run on the injected `raw`.
- `pace()` (cards/hour: weighted average + slowest/fastest qualifying day + per-session capability) and `dayWindow()` (study time realistically left today = a typical day's minutes × the share of your hour-of-day pattern still ahead, capped by `dayCutoff`) power the **Hours Left** card — both are JS-side, no extra collection queries.
- **FSRS** (most sensitive — validate against a real collection): stability/difficulty from `cards.data` JSON (`$.s`/`$.d`), retrievability via forgetting curve with decay −0.5.
- Streak counts back from today; a not-yet-studied today does NOT reset it.
- Offline logic test (no Anki): `python3 dev/web-src/test_data.py` — `data.py` has no `aqt` imports, so a fake collection drives it.

## Settings (gear icon)
Web drawer (`settings.jsx`) → `pycmd("addonismaximus:save:<json>")` → `config_store.py` (Anki `config.json`). Controls: section show/hide + order, goals (targets + custom goals), appearance (theme / text size / card height / chart / corners), data (decks / cutoff hour / mature threshold / streak min).
**Keep `config_store.py` DEFAULT_CONFIG and `config.js` DEFAULT_CONFIG in sync** — including `SECTION_KEYS`↔`SECTIONS` and `DEFAULT_VISIBLE` (which cards ship enabled; listed by key on both sides so inserting a card never silently hides a different one).

## JS ↔ Python bridge
pycmd messages: `addonismaximus:save:<json>`, `addonismaximus:reload`, `addonismaximus:log:<msg>` (debug).
Window → `dialog.set_bridge_command`. Carousel → `gui_hooks.webview_did_receive_js_message` (`embed.py`).

## Publishing to AnkiWeb
The upload package = **the contents of `addonismaximus/`**. Zip the files *inside* `addonismaximus/` (so `__init__.py` sits at the zip root — do NOT zip the `addonismaximus` folder itself), then upload at ankiweb.net → *Share* → *Upload*. Everything else lives in `dev/` and must not ship.
- **Include:** `__init__.py`, `core.py`, `embed.py`, `dialog.py`, `config_store.py`, `data.py`, `manifest.json`, `config.json`, `config.md`, `web/addonismaximus.js`, `web/fonts/*.woff2`. (`web/index.html` is dev-only — harmless, optional to drop.)
- **Exclude** (Anki-generated / runtime, all git-ignored): `meta.json`, `__pycache__/` (both reappear whenever Anki runs through the symlink, so re-check right before zipping) and any stale `addonismaximus.log` left over from before debug logging was removed.

## Pending / TODO
- [x] Carousel size — already user-adjustable via Settings → Appearance → **Text size** (`textScale`, base `0.656`). Re-baseline the `0.656` knob in `styles.css` if a different default is ever wanted.
- [x] Add-on display name — `manifest.json` already reads "Addonis Maximus".
- [x] Debug logging removed — `embed.py` (`_log()`, the inline reporter, the `addonismaximus:log:` handler, `register()` log) and `main.jsx` (`report()`) are gone; nothing writes `addonismaximus/addonismaximus.log` anymore.
- [x] FSRS math audited & hardened in `data.py`: reads per-card `$.decay` (FSRS-6) with `-0.5` fallback; skips non-positive `true_due` (filtered-deck `odue`); difficulty divides by count-of-cards-with-`$.d`; no-FSRS fallback now honors the deck filter; top band relabeled `95%+`. Core curve verified exact (factor `19/81`, R(0)=1, R(S)=0.9). Invariants + regression cases locked in `dev/web-src/test_data.py`.
  - [ ] Optional: sanity-check against a real FSRS-6 collection — confirm Anki actually stores `$.decay` in `cards.data` (the read falls back to `-0.5` if absent, so there's no regression either way).

## Git restore points
- `daf29a1` — working add-on BEFORE the compact resize.
- latest commit — compact sizing + cache-bust + streak fix (this handover).
Compare/restore with `git log --oneline`, `git diff <hash>`, or `git checkout <hash> -- <file>`.

## Gotchas
- Webview caches assets aggressively — always version the URL (handled by `core.script_url()`).
- The carousel mounts in a **Shadow DOM** for style isolation; theme tokens are on `:host`; fonts are injected at runtime with an absolute path (`main.jsx`).
- `addonismaximus/meta.json` (and the now-retired `addonismaximus/addonismaximus.log`) are git-ignored. Debug logging was removed, so `addonismaximus.log` is no longer written.
