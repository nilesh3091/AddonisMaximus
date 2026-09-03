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
  web-src/build.mjs · web-src/server.mjs · web-src/test_data.py · web-src/test_core.py · web-src/package.json
  package.sh             build the AnkiWeb upload zip (gates + staging) — USE THIS TO PUBLISH
  sync_config.py         regenerate addonismaximus/config.json from config_store.DEFAULT_CONFIG
  design_handoff_anki_progress/   original design artifacts (reference only)
  README.md              project readme
```

## Data
- Real data is ON: `core.USE_REAL_DATA = True`. Only a *failed* build falls back to JS sample data (`dataState: "unavailable"`), so the panel never breaks — see **Fixed — the home-screen freeze** for why a cold cache must not.
- `data.py build_dataset(col, cfg, want_projection=True)` → `raw = {today, dayCutoff, decks, allDecks, days[], hourly, forecast, projection, pending}`. Cached in `core._cache` on `(col.mod, data-scope, sched.today, wants_projection)`; **built on a background thread**, never in the render hook.
- Aggregation (trend / period / goals / streak / deckBoard) is in **JS** `buildAnki()` (`data.js`), run on the injected `raw`.
- `pace()` (cards/hour: weighted average + slowest/fastest qualifying day + per-session capability) and `dayWindow()` (study time realistically left today = a typical day's minutes × the share of your hour-of-day pattern still ahead, capped by `dayCutoff`) power the **Hours Left** card — both are JS-side, no extra collection queries.
- **FSRS** (most sensitive — validate against a real collection): stability/difficulty from `cards.data` JSON (`$.s`/`$.d`), retrievability via forgetting curve with decay −0.5.
- Streak counts back from today; a not-yet-studied today does NOT reset it.
- Offline logic tests (no Anki): `python3 dev/web-src/test_data.py` — `data.py` has no `aqt` imports, so a fake collection drives it — and `python3 dev/web-src/test_core.py`, which stubs `aqt` (including a `QueryOp` that *queues* instead of running, so "still building" is an inspectable state rather than a race) to cover the cache key, the cold-cache placeholder, single-flight, overlapping builds, and the projection gate. Both are `package.sh` gate 2.

## Settings (gear icon)
Web drawer (`settings.jsx`) → `pycmd("addonismaximus:save:<json>")` → `config_store.py` (Anki `config.json`). Controls: section show/hide + order, goals (targets + custom goals), appearance (theme / text size / card height / chart / corners), data (decks / cutoff hour / mature threshold / streak min).
**Keep `config_store.py` DEFAULT_CONFIG and `config.js` DEFAULT_CONFIG in sync** — including `SECTION_KEYS`↔`SECTIONS` and `DEFAULT_VISIBLE` (which cards ship enabled; listed by key on both sides so inserting a card never silently hides a different one).

**There is a third copy: `addonismaximus/config.json`.** It is what Anki seeds a *fresh install* with (and what the add-on's Config editor shows), and Anki hands it to `get_config()` as `stored` — where lists *replace* rather than merge, so a stale `sections.order`/`hidden` there overrides `DEFAULT_CONFIG` and new users get card defaults the code never intended. It drifted exactly that way once: it still listed `fsrs`/`deckBoard`/`records`/`achievements` long after those cards were deleted and omitted `pending`/`pace`/`time`, so a fresh install came up with **`pace` and `time` switched on** and the order scrambled. Never hand-edit it — regenerate:

```bash
python3 dev/sync_config.py           # rewrite config.json from config_store.DEFAULT_CONFIG
python3 dev/sync_config.py --check   # exit 1 if stale (dev/package.sh gate 1)
```

## JS ↔ Python bridge
pycmd messages: `addonismaximus:save:<json>`, `addonismaximus:reload`, `addonismaximus:ready`, `addonismaximus:save_image:<data-uri>`.

`ready` is sent once, on mount, only when the page booted with `dataState: "loading"`. The render hook starts the background build while it is still writing the HTML, so on a small collection the build can finish and push before the new page is committed — landing the eval on the outgoing document and stranding the panel on its placeholder. `ready` can only fire from a live page, and Python answers it through the same `start_build`, which serves the cache or joins the in-flight build, so it never costs a second scan.
Window → `dialog.set_bridge_command`. Carousel → `gui_hooks.webview_did_receive_js_message` (`embed.py`).

`save_image` backs the **Share** feature: Settings → *Share* (`ShareSection`, `settings.jsx`) draws a transparent stats sticker on a canvas and hands the PNG data-URI to Python, which offers a save dialog defaulting to `~/Downloads`. The Anki logo it stamps is an embedded base64 data URI (`src/anki_b64.js`), not a file read at runtime — that's most of the bundle's size. The Streak card's header **Share** button just opens this drawer (`onShare` is threaded like `onAddGoal`, from both mounts); it renders only when a handler is supplied, so it can never ship as a button that does nothing.

A `reload` is an **uncached, full-collection rebuild** — now on a background thread via `core.start_build`, but still seconds of work — so it is debounced 500 ms in `useAddonisMaximus.jsx` and only fires when the build's inputs actually change: the four `config.data` keys Python reads (`PY_DATA_KEYS`, mirrored by `core._PY_DATA_KEYS`) plus whether the Maturity card is on screen (`wantsProjection`, mirroring `core.wants_projection`). `streakMinCards` is applied purely in JS — asking Python to recompute for it rebuilt the whole collection for a byte-identical result.

## Publishing to AnkiWeb
**Use the script — do not hand-zip.** `meta.json` and `__pycache__/` reappear every time Anki runs through the symlink, and `meta.json` contains *your own* config (deck names, goals), so hand-zipping ships it to every user.

```bash
./dev/package.sh            # pre-flight, then build upload.zip
./dev/package.sh --check    # run the gates only, package nothing
```

Pre-flight gates: `config.json` is in sync with `config_store.DEFAULT_CONFIG`; `test_data.py` and `test_core.py` pass; the committed bundle rebuilds byte-identical from source (a stale committed bundle is a silent ship-the-wrong-code bug). Then upload `upload.zip` at ankiweb.net → *Share* → *Upload* (add-on **#306644033**).

The package = **the contents of `addonismaximus/`**, so `__init__.py` sits at the zip root — never the `addonismaximus` folder itself. Everything under `dev/` is excluded.
- **Includes:** `__init__.py`, `core.py`, `embed.py`, `dialog.py`, `config_store.py`, `data.py`, `manifest.json`, `config.json`, `config.md`, `LICENSE`, `THIRD-PARTY-NOTICES.md`, `web/addonismaximus.js`, `web/fonts/*.woff2`, `web/fonts/OFL.txt`.
- **Licensing — the package must carry its own notices.** The add-on is AGPL-3.0 but the zip used to ship no licence at all, no copyright notice, and no source pointer, while redistributing a *minified* bundle (esbuild `legalComments: "none"` strips React's MIT headers) and two SIL OFL fonts. So `addonismaximus/LICENSE` (AGPL, copied from the repo root), `addonismaximus/THIRD-PARTY-NOTICES.md` (React/react-dom/scheduler MIT texts) and `web/fonts/OFL.txt` (both font copyright lines + the OFL 1.1 body) now ship, and `manifest.json` carries `homepage` pointing at the GitHub source — which also fixes the Add-ons dialog's "View Add-on Page" button, previously enabled but a silent no-op on a sideloaded copy. Re-copy `LICENSE` if the root one ever changes.
- **Excludes:** `meta.json`, `__pycache__/`, `*.pyc`, `*.log`, `.DS_Store`, and `web/index.html` (dev-only preview page, used by `dev/web-src/server.mjs`).
- `upload/` and `upload.zip` are git-ignored.

## Pending / TODO
- [x] Carousel size — already user-adjustable via Settings → Appearance → **Text size** (`textScale`, base `0.656`). Re-baseline the `0.656` knob in `styles.css` if a different default is ever wanted.
- [x] Add-on display name — `manifest.json` already reads "Addonis Maximus".
- [x] Debug logging removed — `embed.py` (`_log()`, the inline reporter, the `addonismaximus:log:` handler, `register()` log) and `main.jsx` (`report()`) are gone; nothing writes `addonismaximus/addonismaximus.log` anymore.
- [x] FSRS math audited & hardened in `data.py`: reads per-card `$.decay` (FSRS-6) with `-0.5` fallback; skips non-positive `true_due` (filtered-deck `odue`); difficulty divides by count-of-cards-with-`$.d`; no-FSRS fallback now honors the deck filter; top band relabeled `95%+`. Core curve verified exact (factor `19/81`, R(0)=1, R(S)=0.9). Invariants + regression cases locked in `dev/web-src/test_data.py`.
  - [ ] Optional: sanity-check against a real FSRS-6 collection — confirm Anki actually stores `$.decay` in `cards.data` (the read falls back to `-0.5` if absent, so there's no regression either way).
- [x] Pre-release audit (see the release commit): fresh-install config defaults, light-mode heat ramp, day-rollover cache key, retention denominator, empty-deck-filter, settings-keystroke rescan, dead Share button. Regression assertions for the deck filter and the retention invariant are in `test_data.py`.

### Fixed — the home-screen freeze
- [x] **`build_dataset` no longer runs on Anki's Qt main thread.** It used to, inside
  `gui_hooks.deck_browser_will_render_content` (`embed.py` → `core.bootstrap_json` →
  `compute_raw`), freezing the home screen with no progress indicator — and it recurred on
  every return to the deck list after studying, because `_cache_key` includes `col.mod` and
  every write bumps it. Measured on a synthetic collection: **6.0 s** at 1.2M revlog / 200k
  cards, **1.9 s** at 400k / 80k.

  The render hook now calls **`core.cached_raw(cfg)`**, which only ever reads the in-memory
  cache and never touches the revlog, and — when that comes back empty —
  **`core.start_build(cfg, deliver)`**, which hands `build_dataset` to a `QueryOp`
  (`uses_collection=True`, so it serialises against Anki's own collection ops rather than
  racing them the way a raw `taskman.run_in_background` over `col.db.all` would). No
  `.with_progress()`: a modal spinner over the deck list would be worse than the wait it
  replaces. When the build lands, `embed._push_data` evals
  `window.addonismaximusSetData(<json>)` into `mw.web`, guarded with `&&` because the deck
  browser and the reviewer share that webview.

  **A cold cache renders a placeholder, never the sample data.** The bootstrap blob carries
  `dataState`: `"ready"` (real dataset attached) · `"loading"` (a build is running — the web
  layer shows "Reading your review history…" and waits) · `"unavailable"` (real data off, no
  collection, or the build failed — only *then* does the JS sample collection stand in, which
  is the long-standing fallback). A null dataset alone was ambiguous, and the old code resolved
  it the worst possible way: by drawing the sample collection's numbers under the user's own
  deck list. The dev preview has no bootstrap blob at all, so it still gets sample data;
  `?loading=1` there previews the placeholder.

  Single-flight: a second render for the same cache key joins the running build. A build for a
  *different* key supersedes it, and each build delivers to the waiter list it captured at
  start — reading `_build["waiters"]` back at completion let a finishing build clear its
  successor's bookkeeping and strand the newer render on the placeholder forever
  (`test_core.py` case 9).

  **No `operation_did_execute` warm hook**, deliberately. Anki already refreshes the deck
  browser when an op changes study state, so the render hook fires anyway and starts the
  build — a warm hook there would be a duplicate scan, and during review (where every answer
  bumps `col.mod`) it would rebuild the whole collection between cards.
- [x] **`_projection` is gated on the Maturity ETA card actually being on screen.**
  `core.wants_projection(cfg)` — mirrored in JS by `wantsProjection` in
  `useAddonisMaximus.jsx` — is true when `maturity` is not in `sections.hidden` or when a
  multi-mode block slot holds it. It is **part of `_cache_key`**, and part of the JS reload
  trigger, so turning the card on misses the cache and rebuilds instead of rendering
  "Not enough history yet" until the next collection write. The card ships hidden
  (`DEFAULT_VISIBLE`), so the default install skips it: **1.9 s instead of 6.0 s** at 1.2M rows.
- [x] **The projection's two unbounded `GROUP BY cid` revlog scans are one bounded scan.**
  They read the entire table twice — every row ever written, including rows for deleted cards
  and for decks the include-filter excludes — for 2.2 s + 1.9 s of that 6.0 s build. They are
  now a single scan with two `CASE` aggregates, joined to exactly the cards the projection
  iterates: **2.1 s**, or **0.68 s** with a two-deck filter. `_deck_where(dids, alias)` grew the
  alias argument so the same filter serves both the `cards` query and the joined one. Verified
  byte-identical against the old code on a 1.2M-row collection across four config scopes
  (all decks / deck filter / excludeSuspended / mature=60).

  Net: **1.9 s** default config, **4.4 s** with Maturity on — all of it off the main thread.

## Git restore points
- `daf29a1` — working add-on BEFORE the compact resize.
- `f5863f3` — last commit before the pre-release audit fixes.
Compare/restore with `git log --oneline`, `git diff <hash>`, or `git checkout <hash> -- <file>`.

## Gotchas
- Webview caches assets aggressively — always version the URL (handled by `core.script_url()`).
- The carousel mounts in a **Shadow DOM** for style isolation; theme tokens are on `:host`; fonts are injected at runtime with an absolute path (`main.jsx`).
- `addonismaximus/meta.json` (and the now-retired `addonismaximus/addonismaximus.log`) are git-ignored. Debug logging was removed, so `addonismaximus.log` is no longer written.
