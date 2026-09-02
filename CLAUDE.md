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
- **Year heat-map:** responsive by construction — `computeHeatmap` (`cards-core.jsx`) solves the cell size from the measured column so the calendar always fills it; the `box` a caller passes is the *ceiling*, `HEAT_MIN_BOX` (7) the floor, and only below that floor does it drop the oldest month. The window is `HEAT_MONTHS` (10) trailing months through the current one plus `HEAT_AHEAD` (2) months of days still to come, so today never sits against the right edge — the month ahead is paid for out of history, and the fit only ever trims from the front (never below current + ahead). Past days shade green over **ten** steps (`HEAT_LEVELS`, values in `styles.css` as `--heat-1…10` so the `daylight` theme can flip the ramp; `--heat-0` is a day with nothing done and is deliberately *darker* than the card — `#222` — so a missed day reads as a hole, which the old translucent `--ring-track` could not do). **The ramp follows the surface, not the theme**: `applyAnkiSurfaces()` repaints the card to match Anki's own page, so a dark theme on a light-mode Anki left `--heat-0: #222` punching near-black holes in a white card (and `daylight` on a dark Anki did the inverse). `applyAnkiSurfaces` now measures the background it resolved and stamps `data-surface="light"|"dark"` on the host; `styles.css` re-pins the whole ramp from that, in blocks placed *after* every theme so they win — the Review Heatmap add-on's "lime" ramp. Crucially the thresholds are `HEAT_FACTORS` × *a typical day* (the mean over studied days in the window, floored at 20), not fractions of the busiest day: scaling to the max lets one cram session flatten a year into the bottom shade. The current streak's days are ringed in accent, driven by `anki.streakFrom`/`streakTo` from `data.js`.; days ahead deliberately stay blank — the same empty square as a day with nothing done — but still carry `due` / `dueYoung` / `dueMature` from `anki.forecast[daysFromToday]` for the hover read-out. That is why `data.py FORECAST_DAYS` is **93**, not 30 — the hover has to reach the end of the month ahead; the Forecast card still slices its own first 30. The measured wrapper carries `contain: inline-size` — load-bearing, since the window's card column is a content-sized grid track and the calendar would otherwise feed its own width back into it. Hover/tap a day for a tooltip (Today / Best day / Scheduled badge · date · cards done or cards due · time · retention or young/mature split) drawn by `HeatCalendar`, shared by the Streak card and the heat-map panel; today's cell gets a pulsing accent halo from `.heat-today` in `styles.css` (drawn on `::after` so it layers over the hover/pinned/best-day rings instead of fighting them).
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
  package.sh             build the AnkiWeb upload zip (gates + staging) — USE THIS TO PUBLISH
  sync_config.py         regenerate addonismaximus/config.json from config_store.DEFAULT_CONFIG
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

**There is a third copy: `addonismaximus/config.json`.** It is what Anki seeds a *fresh install* with (and what the add-on's Config editor shows), and Anki hands it to `get_config()` as `stored` — where lists *replace* rather than merge, so a stale `sections.order`/`hidden` there overrides `DEFAULT_CONFIG` and new users get card defaults the code never intended. It drifted exactly that way once: it still listed `fsrs`/`deckBoard`/`records`/`achievements` long after those cards were deleted and omitted `pending`/`pace`/`time`, so a fresh install came up with **`pace` and `time` switched on** and the order scrambled. Never hand-edit it — regenerate:

```bash
python3 dev/sync_config.py           # rewrite config.json from config_store.DEFAULT_CONFIG
python3 dev/sync_config.py --check   # exit 1 if stale (dev/package.sh gate 1)
```

## JS ↔ Python bridge
pycmd messages: `addonismaximus:save:<json>`, `addonismaximus:reload`, `addonismaximus:save_image:<data-uri>`.
Window → `dialog.set_bridge_command`. Carousel → `gui_hooks.webview_did_receive_js_message` (`embed.py`).

`save_image` backs the **Share** feature: Settings → *Share* (`ShareSection`, `settings.jsx`) draws a transparent stats sticker on a canvas and hands the PNG data-URI to Python, which offers a save dialog defaulting to `~/Downloads`. The Anki logo it stamps is an embedded base64 data URI (`src/anki_b64.js`), not a file read at runtime — that's most of the bundle's size. The Streak card's header **Share** button just opens this drawer (`onShare` is threaded like `onAddGoal`, from both mounts); it renders only when a handler is supplied, so it can never ship as a button that does nothing.

A `reload` is an **uncached, full-collection rebuild on Anki's main thread**, so it is debounced 500 ms in `useAddonisMaximus.jsx` and only fires for the four `config.data` keys Python actually reads (`PY_DATA_KEYS`, mirrored by `core._PY_DATA_KEYS`). `streakMinCards` is applied purely in JS — asking Python to recompute for it rebuilt the whole collection for a byte-identical result.

## Publishing to AnkiWeb
**Use the script — do not hand-zip.** `meta.json` and `__pycache__/` reappear every time Anki runs through the symlink, and `meta.json` contains *your own* config (deck names, goals), so hand-zipping ships it to every user.

```bash
./dev/package.sh            # pre-flight, then build upload.zip
./dev/package.sh --check    # run the gates only, package nothing
```

Pre-flight gates: `config.json` is in sync with `config_store.DEFAULT_CONFIG`; `test_data.py` passes; the committed bundle rebuilds byte-identical from source (a stale committed bundle is a silent ship-the-wrong-code bug). Then upload `upload.zip` at ankiweb.net → *Share* → *Upload* (add-on **#306644033**).

The package = **the contents of `addonismaximus/`**, so `__init__.py` sits at the zip root — never the `addonismaximus` folder itself. Everything under `dev/` is excluded.
- **Includes:** `__init__.py`, `core.py`, `embed.py`, `dialog.py`, `config_store.py`, `data.py`, `manifest.json`, `config.json`, `config.md`, `web/addonismaximus.js`, `web/fonts/*.woff2`.
- **Excludes:** `meta.json`, `__pycache__/`, `*.pyc`, `*.log`, `.DS_Store`, and `web/index.html` (dev-only preview page, used by `dev/web-src/server.mjs`).
- `upload/` and `upload.zip` are git-ignored.

## Pending / TODO
- [x] Carousel size — already user-adjustable via Settings → Appearance → **Text size** (`textScale`, base `0.656`). Re-baseline the `0.656` knob in `styles.css` if a different default is ever wanted.
- [x] Add-on display name — `manifest.json` already reads "Addonis Maximus".
- [x] Debug logging removed — `embed.py` (`_log()`, the inline reporter, the `addonismaximus:log:` handler, `register()` log) and `main.jsx` (`report()`) are gone; nothing writes `addonismaximus/addonismaximus.log` anymore.
- [x] FSRS math audited & hardened in `data.py`: reads per-card `$.decay` (FSRS-6) with `-0.5` fallback; skips non-positive `true_due` (filtered-deck `odue`); difficulty divides by count-of-cards-with-`$.d`; no-FSRS fallback now honors the deck filter; top band relabeled `95%+`. Core curve verified exact (factor `19/81`, R(0)=1, R(S)=0.9). Invariants + regression cases locked in `dev/web-src/test_data.py`.
  - [ ] Optional: sanity-check against a real FSRS-6 collection — confirm Anki actually stores `$.decay` in `cards.data` (the read falls back to `-0.5` if absent, so there's no regression either way).
- [x] Pre-release audit (see the release commit): fresh-install config defaults, light-mode heat ramp, day-rollover cache key, retention denominator, empty-deck-filter, settings-keystroke rescan, dead Share button. Regression assertions for the deck filter and the retention invariant are in `test_data.py`.

### Known defect — not fixed, deliberately
- [ ] **`build_dataset` runs synchronously on Anki's Qt main thread**, inside `gui_hooks.deck_browser_will_render_content` (`embed.py` → `core.bootstrap_json` → `compute_raw`). Anki's home screen freezes while it runs, with no progress indicator. Measured: **0.33 s** at 54k revlog / 39k cards, **~2.4 s** at 400k revlog, **~6.6 s** at 1.2M revlog. It recurs constantly because `_cache_key` includes `col.mod`, which every write bumps — so every return to the deck list after studying pays full price.
  This is **pre-existing shipped behaviour, not a regression** (the render path dates to the first commit; `_projection` to `70c8123`, before the rename that produced the current listing), which is why the release went out with it. Fixing it properly means moving the build off the main thread with Anki's own `QueryOp`/`CollectionOp` and defining what a cold cache renders — *not* `taskman.run_in_background` doing raw `col.db.all`, and *not* falling back to the JS sample data (users would briefly see fabricated numbers). Debouncing `operation_did_execute` is required or it makes things worse.
  Cheap wins already taken: one `fromtimestamp` per revlog row instead of three, and the reload debounce. Still available: gate `_projection` on whether the Maturity card is actually visible (needs `sections.hidden` in `_cache_key` and cache invalidation on save, or enabling the card renders "Not enough history yet"), and bound its two unbounded `GROUP BY cid` revlog scans.

## Git restore points
- `daf29a1` — working add-on BEFORE the compact resize.
- `f5863f3` — last commit before the pre-release audit fixes.
Compare/restore with `git log --oneline`, `git diff <hash>`, or `git checkout <hash> -- <file>`.

## Gotchas
- Webview caches assets aggressively — always version the URL (handled by `core.script_url()`).
- The carousel mounts in a **Shadow DOM** for style isolation; theme tokens are on `:host`; fonts are injected at runtime with an absolute path (`main.jsx`).
- `addonismaximus/meta.json` (and the now-retired `addonismaximus/addonismaximus.log`) are git-ignored. Debug logging was removed, so `addonismaximus.log` is no longer written.
