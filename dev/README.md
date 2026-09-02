# Addonis Maximus — dev notes

A Strava-style study dashboard for Anki 25.09 (Qt6): goal rings, an activity
trend graph, a 12-month study heat-map and a library of extra cards, driven by
your real collection.

Nothing under `dev/` ships. The add-on is `../addonismaximus/`.

## The only surface: the home-screen panel

The panel is injected into Anki's deck browser, below the heatmap (`embed.py`).
It renders in one of two view modes (Settings → Appearance → View mode):

- **Multi** (default) — three stacked blocks: goal rings, trend graph, heat-map.
  Each block has a **pencil** in its corner to swap in any other card.
- **Single** — a swipe carousel, one enabled card at a time (arrows / dots / swipe).

The full-window dashboard in `dialog.py` still builds, but **nothing launches it** —
its Tools-menu item and toolbar link were removed. It can still be previewed
offline (below) or re-wired to an entry point later.

Click the **gear** for settings. Remove the dev install with:
`rm "~/Library/Application Support/Anki2/addons21/addonismaximus"`

## Layout

```
AnkStats/
├─ addonismaximus/               THE ADD-ON (loads in Anki; its *contents* are the upload)
│  ├─ __init__.py                  web exports + embed.register()
│  ├─ core.py                      web base, cached real-data builder, bootstrap JSON
│  ├─ embed.py                     deck-browser injection + pycmd bridge
│  ├─ dialog.py                    window mode (retained, not launched)
│  ├─ config_store.py              settings defaults / load / save
│  ├─ data.py                      real collection queries -> raw dataset
│  ├─ manifest.json · config.json · config.md
│  ├─ LICENSE · THIRD-PARTY-NOTICES.md   AGPL text + bundled React/font notices
│  └─ web/                         BUILT, committed assets
│     ├─ addonismaximus.js (CSS bundled in) · index.html (dev preview only)
│     └─ fonts/  *.woff2 + OFL.txt (the fonts' licence must ship with them)
└─ dev/                            does NOT ship
   ├─ package.sh                   build the AnkiWeb upload zip  ← use this to publish
   ├─ sync_config.py               regenerate config.json from config_store.DEFAULT_CONFIG
   ├─ design_handoff_anki_progress/  reference design (untouched)
   └─ web-src/                     dev source (React + esbuild)
      ├─ src/*.jsx · src/*.js · src/styles.css   (main, app, embed, settings, cards…)
      └─ build.mjs · server.mjs · test_data.py · package.json
```

## Develop the web layer

```bash
cd web-src
npm install          # once
npm run build        # one-shot -> ../../addonismaximus/web/addonismaximus.js
npm run watch        # rebuild on change
node server.mjs      # preview at http://127.0.0.1:8123 (honors $PORT)
```

**Editing `web-src/src/*` has no effect until you rebuild**, then restart Anki.
Cache-busting is automatic (`core.script_url()` appends `?v=<bundle mtime>`).

The web app reads `window.__ADDONISMAXIMUS__ = { config, data, mode, webBase }`
injected by Python. With no host (plain browser) it falls back to **sample data** +
`localStorage`, so the whole panel is testable without Anki. Add **`?embed=1`** to
the dev URL for the home-screen panel; otherwise you get the window view.

`addonismaximus/data.py` has no Anki imports, so it is unit-tested offline
against a fake collection: `python3 web-src/test_data.py`.

## Settings

Edited in-panel (gear icon) and persisted to Anki's add-on config:
- **Appearance** — view mode, theme (5), text size, card height, trend chart, corners.
- **Cards & sections** — show/hide and reorder every card, and pick the opening card.
- **Goals** — targets for Cards / Study Time / New Cards / Days Studied, plus custom
  goals; each tracks either your own recent average or a fixed weekly number, and
  month/year scale automatically.
- **Data & collection** — included decks, day rollover, mature threshold, streak minimum.
- **Share** — export a transparent stats sticker as a PNG.

Three copies of the default config must agree: `config_store.py` (Python),
`web-src/src/config.js` (JS), and `addonismaximus/config.json` (what Anki seeds a
**fresh install** with). Never hand-edit the last one — run `python3 dev/sync_config.py`.

## Real data

`data.py build_dataset(col, cfg)` builds the `raw` shape from the real collection:
daily revlog buckets (manual reschedules excluded), forecast, hourly distribution,
per-deck split + retention, deck-maturity projection, and today's pending counts.
Aggregation (trend, goals, streak, pace) happens JS-side in `data.js buildAnki()`.

Results are cached on collection mod-time **and the current Anki day**, so the panel
doesn't rescan on every render but also can't serve yesterday's numbers after
rollover. Real data is on by default (`core.USE_REAL_DATA = True`); if any query
fails the web layer falls back to sample data so the panel never breaks.

Validate numbers against your own collection. Note that `build_dataset` currently
runs on Anki's **main thread** during the deck-browser render — see the "Known
defect" note in `../CLAUDE.md` before making it do more work.

## Publish

```bash
./dev/package.sh
```

Runs the pre-flight gates (config in sync, tests pass, committed bundle matches
source), stages `addonismaximus/` minus runtime junk, and writes `upload.zip` for
ankiweb.net → *Share* → *Upload*. Never hand-zip: `meta.json` holds *your* config.
