# Recall — Anki Progress

A Strava-style study dashboard for Anki: goals, activity trend, streak calendar,
forecast, answer buttons, best-study-time, FSRS memory strength, deck
leaderboard, personal records, and achievements — driven by your real collection.

Two presentations from one bundle:
- **Home screen** — a compact **carousel** embedded below the heatmap; one
  enabled card at a time, flip with arrows / dots / swipe.
- **Window** — the full scrolling dashboard (Tools → Recall — Progress).

Both share a **settings drawer** (gear icon) to choose which cards are shown
(and their order), edit goals, and theme it.

## Layout

```
AnkStats/
├─ design_handoff_anki_progress/   reference design (untouched)
├─ recall/                         THE ADD-ON (loads in Anki)
│  ├─ __init__.py                  Tools-menu + toolbar entry, web exports, hooks
│  ├─ core.py                      shared web base + cached real-data builder
│  ├─ dialog.py                    window mode: AnkiWebView host + bridge
│  ├─ embed.py                     home-screen carousel: deck-browser hook + bridge
│  ├─ config_store.py              settings defaults / load / save / migrate
│  ├─ data.py                      real-collection queries (revlog / FSRS / decks)
│  ├─ manifest.json · config.json · config.md
│  └─ web/                         BUILT, committed assets
│     ├─ recall.js (CSS bundled in) · index.html · fonts/
└─ web-src/                        dev source (React + esbuild) — does NOT ship
   ├─ src/*.jsx · src/*.js · src/styles.css   (main, app, embed, settings, …)
   ├─ build.mjs · server.mjs · test_data.py · package.json
```

## Run it in Anki

The add-on is symlinked into `~/Library/Application Support/Anki2/addons21/recall`.
**Restart Anki**. It appears in two places:
- on the **home screen** (deck browser) as a carousel below the heatmap, and
- as a window via **Tools → Recall — Progress** or the top-toolbar **Progress** link.

Click the **gear** for settings (cards shown, goals, theme, data scope).

Remove the dev install with: `rm "~/Library/Application Support/Anki2/addons21/recall"`

## Develop the web layer

```bash
cd web-src
npm install          # once
npm run build        # one-shot -> ../recall/web/recall.js (CSS + fonts refs bundled in)
npm run watch        # rebuild on change
node server.mjs      # preview at http://127.0.0.1:8123 (honors $PORT)
```

The web app reads `window.__RECALL__ = { config, data, mode, webBase }` injected by
Python. With no host (plain browser) it falls back to **sample data** +
`localStorage`, so the whole panel is testable without Anki. Add **`?embed=1`** to
the dev URL to preview the home-screen carousel; otherwise you get the window view.

Logic in `recall/data.py` has no Anki imports, so it's unit-tested offline against
a fake collection: `python3 web-src/test_data.py`.

## Settings

Edited in-panel (gear icon) and persisted to Anki's add-on config:
- **Appearance** — theme (5), trend chart (area/bars), corners (round/sharp).
- **Cards & sections** — show/hide and reorder every card.
- **Goals** — edit weekly targets for Cards / Study Time / New Cards / Days
  Studied, and add/remove custom goals (monthly & yearly scale automatically).
- **Data & collection** — day rollover, mature threshold, streak minimum,
  included decks.

`config_store.py` (Python) and `web-src/src/config.js` (JS) hold the **same**
default shape — keep them in sync.

## Real data

`recall/data.py` `build_dataset(col, cfg)` builds the `raw` shape from the real
collection: daily revlog buckets (manual reschedules excluded), streak, forecast
(review-queue due counts), hourly distribution, per-deck split + retention,
records, achievements, and FSRS memory state (stability/difficulty from
`cards.data` `$.s`/`$.d`, retrievability via the forgetting curve, recall bands).
Results are cached on collection mod-time so the home-screen embed doesn't rescan
on every render. It's on by default (`core.USE_REAL_DATA = True`); if any query
fails the web layer falls back to sample data so the panel never breaks.

Validate the numbers against your own collection — the FSRS card is the most
sensitive (recall bands assume the FSRS-5 decay of −0.5).
