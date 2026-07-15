# Handoff: Addonis Maximus (Strava-style study dashboard)

## Overview
**Addonis Maximus** is a "Progress" screen for an **Anki add-on** that reframes spaced-repetition study data as a Strava-style fitness dashboard. It shows goals, an activity trend, a study-streak calendar, a review forecast, answer-button breakdown, best-study-time histogram, FSRS memory-strength stats, a deck leaderboard, personal records, and achievements.

The screen is dark, warm-near-black, with a signal-orange accent for data viz and **green** reserved for *progress completion* (goal rings, progress fills). It renders inside a faux Anki desktop top bar so it reads as a native add-on panel.

> **Important constraint from the product owner:** an Anki add-on has **limited panel space — only one add-on view is shown at a time** (it replaces one of Anki's existing panels). The current handoff design is the full-width desktop layout. If you are targeting the real add-on slot, expect to reflow this into a **single narrow scrollable column** (~660px) where every card spans full width and the user scrolls through cards one at a time. The card *contents* and styling stay identical — only the grid column spans change. (A narrow-column variant was prototyped during design; the grid is already a 12-col system so collapsing every card to `span 12` is the mechanism.)

## About the Design Files
The files in this bundle are **design references created in HTML/React-via-Babel** — a working prototype showing the intended look and behavior. **They are not production code to ship directly.** The task is to **recreate this design inside your target codebase** (the Anki add-on environment — typically Python + Qt `QWebEngineView` rendering bundled HTML/CSS/JS, or whatever web stack the add-on already uses) using its established patterns, build tooling, and real data sources.

If there is no existing front-end environment in the add-on yet, choose the most appropriate approach for an Anki add-on web panel (a bundled static HTML/CSS/JS view talking to Python via `pycmd`/webview bridges is the common pattern) and implement the design there.

**All synthetic data must be replaced with real data** pulled from the Anki collection (review log / `revlog`, card queue, FSRS scheduler stats, deck tree). See **Data Model** below for exactly what each card needs.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, iconography, chart styling, and interactions are all specified. Recreate the UI pixel-faithfully using the exact tokens below. The only thing expected to change for the real add-on is the **layout column widths** (full desktop grid vs. single narrow panel column) and the **data source** (synthetic → real Anki data).

---

## Design Tokens

### Theme system
The prototype ships **5 themes**, switched via a `data-theme` attribute on `<html>`. The default and canonical theme is **`strava`**. There is also a `data-radius` attribute (`round` default / `sharp`) and a `data-chart` attribute (`area` default / `bar`). For production, implement at minimum the `strava` theme; the others are optional nice-to-haves.

All colors are authored in **OKLCH**. Equivalent sRGB hex is given in parentheses for convenience but prefer shipping the OKLCH values (or your codebase's token equivalents).

#### `strava` theme (DEFAULT — build this one)
| Token | OKLCH | ~Hex | Usage |
|---|---|---|---|
| `--bg` | `oklch(0.17 0.006 60)` | `#262320` | app background (top bar, header) |
| `--bg2` | `oklch(0.13 0.006 60)` | `#1c1a17` | page scroll background (body) |
| `--card` | `oklch(0.215 0.006 60)` | `#312e2a` | card surface |
| `--card2` | `oklch(0.255 0.007 60)` | `#3a3733` | inner tiles, track fills, tooltip |
| `--border` | `oklch(1 0 0 / 0.07)` | `rgba(255,255,255,.07)` | card & control borders |
| `--line` | `oklch(1 0 0 / 0.10)` | `rgba(255,255,255,.10)` | chart gridlines |
| `--text` | `oklch(0.97 0.004 70)` | `#f5f3f0` | primary text |
| `--text2` | `oklch(0.74 0.006 70)` | `#b3b0ab` | secondary text/labels |
| `--text3` | `oklch(0.56 0.006 70)` | `#86837e` | tertiary / axis ticks / uppercase mini-labels |
| `--accent` | `oklch(0.69 0.196 42)` | `#e8632a` | **signal orange** — charts, icons, active states, CTA |
| `--accent2` | `oklch(0.78 0.16 52)` | `#f2944b` | lighter accent (gradients) |
| `--accent-ink` | `oklch(0.18 0.02 50)` | `#2a1f17` | ink ON accent backgrounds (range toggle active text) |
| `--ring-track` | `oklch(1 0 0 / 0.09)` | `rgba(255,255,255,.09)` | unfilled portion of progress rings |
| `--glow` | `oklch(0.69 0.196 42 / 0.32)` | — | accent glow shadow |

> The other four themes (`midnight` blue, `aurora` teal, `violet` purple, `daylight` light) are defined in `Addonis Maximus.html` `<style>` if you want to port them — same token names, different values.

### Progress / status colors (NOT theme-dependent)
These are fixed regardless of theme — they encode *meaning*, not branding.

| Token / context | OKLCH | ~Hex | Usage |
|---|---|---|---|
| **Progress green** | `oklch(0.74 0.16 150)` | `#3fc06b` | **Goal ring arcs, the goal icon glyphs** — "you're making progress" |
| `--again` | `oklch(0.66 0.19 25)` | `#ee5340` | Answer button "Again" (red) |
| `--hard` | `oklch(0.76 0.15 70)` | `#e0962f` | Answer button "Hard" (amber) |
| `--good` | `oklch(0.72 0.16 150)` | `#36bd6a` | Answer button "Good" (green) |
| `--easy` | `oklch(0.68 0.14 235)` | `#3d9bdb` | Answer button "Easy" (blue) |

#### FSRS "Cards by predicted retention" heat scale (5 bars, low→high retention)
This is an explicit red→green heat gradient. Order matters — bands run worst retention (top) to best (bottom):
| Band | OKLCH | ~Hex | meaning |
|---|---|---|---|
| `<70%` | `oklch(0.62 0.21 25)` | `#df3b2b` | red — at-risk |
| `70–80%` | `oklch(0.72 0.17 55)` | `#e0822f` | orange |
| `80–90%` | `oklch(0.83 0.16 95)` | `#dcb02e` | yellow |
| `90–95%` | `oklch(0.74 0.16 150)` | `#3fc06b` | green |
| `>95%` | `oklch(0.5 0.11 150)` | `#1f7a44` | dark green — rock solid |

#### Deck leaderboard bar colors (cycled per row)
`var(--accent)` (orange), `oklch(0.72 0.13 205)` (cyan), `oklch(0.72 0.14 305)` (magenta), `oklch(0.76 0.15 135)` (green), `oklch(0.78 0.13 65)` (gold).

### Typography
Two Google Fonts. Load both (weights listed).
- **`Archivo`** (weights 500/600/700/800/900) — token `--font-num`. Used for all **numbers, card titles, headings, CTA**. Tight tracking on big numbers: `letter-spacing: -0.02em` to `-0.03em`.
- **`Hanken Grotesk`** (weights 400/500/600/700) — token `--font-ui`. Used for all **body/UI text, labels, tabs, buttons**.
- (`Archivo Expanded` 700/800 is imported but only used incidentally — optional.)

| Role | Family | Size | Weight | Other |
|---|---|---|---|---|
| Page title (`.phead h1`) | Archivo | 30px | 800 | `letter-spacing:-0.03em; line-height:1` |
| Card title (`.card-h h2`) | Archivo | 15px | 700 | `text-transform:uppercase; letter-spacing:0.01em` |
| Big stat (`.stat .big`) | Archivo | 30px | 800 | unit suffix 16px/700 `--text2` |
| Generic number (`.num`) | Archivo | varies (13–22px) | 800 | `letter-spacing:-0.02em; white-space:nowrap` |
| Body label (`.label`) | Hanken | 12.5px | 600 | `--text2` |
| Mini uppercase label (`.label-sm`) | Hanken | 11.5px | 600 | `--text3; text-transform:uppercase; letter-spacing:0.04em` |
| Tabs / range toggle | Hanken | 13.5px | 700 | — |
| Topbar brand | Archivo | 16px | 800 | `letter-spacing:-0.02em` |

### Spacing, radius, shadow
- Card radius `--r: 18px` (round) / `6px` (sharp). Inner-tile radius `--r-sm: 11px` / `4px`.
- Card padding: `20px 22px`. Card-header bottom margin `16px`.
- Grid gap `--gap: 16px`. Page wrap: `max-width: 1280px; padding: 26px 24px 80px`.
- Pills/toggles: `border-radius: 999px` (chips, streak badge) or `12px` (range toggle, CTA).
- Tooltip / floating shadow: `0 8px 24px rgba(0,0,0,.35)`. Streak badge glow: `0 6px 18px var(--glow)`.
- Topbar height: `46px`, sticky, `border-bottom: 1px solid var(--border)`.

### Icons
Custom 24×24 stroke icon set (`currentColor` stroke, `stroke-width` ~1.8–2, round caps/joins). Full path data is in `icons.jsx`. Names used: `flame, layers, repeat, plus, seedling, rotate, clock, check, target, calendar, sun, globe, bolt, shield, crown, moon, star, infinity, share, brain, chevronL, chevronR, chevronDown, trophy, lock, cards, gauge, spark`. Replace with your codebase's icon system if it has equivalents, but match the stroke-only, rounded aesthetic. **No emoji.**

---

## Layout

Desktop layout is a **12-column grid** (`--gap: 16px`), centered at `max-width: 1280px`. Below 1080px every multi-col card collapses to full width. Row-by-row:

| Row | Left card (col-span) | Right card (col-span) |
|---|---|---|
| 1 | **Goals** (12) | — |
| 2 | **Activity** (7) | **Streak calendar** (5) |
| 3 | **Forecast** (7) | **Answer Buttons** (5) |
| 4 | **When You Study Best** (5) | **Memory Strength / FSRS** (7) |
| 5 | **Deck Leaderboard** (7) | **Personal Records** (5) |
| 6 | **Achievements** (12) | — |

**Top bar** (sticky, `--bg`): brand lockup ("Addonis Maximus" with a brain-mark in an accent rounded square) · nav `Decks / Add / Browse / Progress` (Progress active) · right-aligned "⟳ Synced just now".

**Page header**: `<h1>Your Progress</h1>` with an inline streak pill (`🔥 N-day streak`, flame in accent), a subtitle, and a right-aligned **Week / Month / Year** range toggle (segmented; active segment has `--accent` bg, `--accent-ink` text).

The **range toggle drives most cards** — Goals, Activity headline+trend, Answer Buttons, and Deck Leaderboard all recompute for week/month/year.

---

## Screens / Views (card-by-card spec)

### 1. Goals card (`GoalsCard`)
- Header: target icon (accent) + "GOALS" + a right-aligned "+ Add a Goal" text button (accent).
- 4 equal columns, each: a **circular progress Ring** (size 104, stroke 10) with the goal's icon centered, then a big number, a label, and a `NN% of TARGET` sub-line.
- **Ring arc color = progress green `oklch(0.74 0.16 150)`** (NOT accent orange). The centered **icon glyph is also green**. The unfilled track is `--ring-track`.
- Goals: Cards (target 1,200/wk), Study Time (7h/wk), New Cards (120/wk), Days Studied (7/wk). Targets scale ×4.3 for month, ×52 for year (days target = 30 / 365).
- Ring animates from current value with a staggered delay (`i * 120ms`), `stroke-dashoffset` transition `1.1s cubic-bezier(.2,.8,.2,1)`. Completed rings (≥100%) get an accent `drop-shadow` glow.

### 2. Activity card (`ActivityCard`)
- A horizontal scrollable **tab row** (pill tabs): Total / Reviews / New Cards / Learning / Relearning. Active tab = accent text + accent border.
- "This week/month/year" headline → 3 big stats: selected metric count, Time, Retention %.
- A **TrendChart** (default `area`, toggleable to `bar` via tweak) over the past 12 weeks / 12 months / by year. Area chart has a vertical accent gradient fill, 2.6px accent line, dot markers, hover crosshair + tooltip, right-side y-axis with "nice" rounded max, month/year x-labels.
- A full-width **"See more of your progress"** CTA button: `--accent` background, **white text**, Archivo 800.

### 3. Streak calendar card (`StreakCard`)
- Header: ‹ › month nav + month-year title + "Share" button (next month disabled when at current month).
- Two stats: "Your Streak" (N days, accent) and "Total Sessions".
- A **streak badge** on the right: orange (`--accent`) rounded-999 pill, glow shadow, containing a **white flame icon** + a **white** week-streak number (the small "WK STREAK" caption is intentionally invisible/transparent in current design).
- A **7-column month grid** (Monday-first). Studied days = filled accent circle with a **white brain icon** inside. Today (if not studied) = accent ring outline + glow. Future days dimmed. Empty leading cells for month offset.

### 4. Forecast card (`ForecastCard`)
- Header: calendar icon + "FORECAST" + "Next 30 days".
- Two stats: Due tomorrow, Next 7 days.
- A **stacked Bars** chart (30 days): "Mature" (accent) stacked under/over "Young" (`color-mix(accent 55%, card2)`), x-label every 5 days, hover tooltip. Legend below.

### 5. Answer Buttons card (`AnswerButtonsCard`)
- Header: gauge icon + "ANSWER BUTTONS" + "True retention NN%".
- A single **segmented horizontal bar** (height 26, radius 7, 2px gaps) split Again/Hard/Good/Easy using the status colors above.
- Below: 4-column breakdown, each with a color dot, label, big percentage, and raw count.

### 6. When You Study Best card (`HourlyCard`)
- Header: clock icon + "WHEN YOU STUDY BEST" + "Peak Xa/p".
- A 24-bar **hourly histogram** (custom SVG). Peak hour bar = full accent; others = `color-mix(accent 28%, card2)`. x-ticks every 3 hours (`12a`,`3a`,…). Per-bar `<title>` tooltip shows hour + retention.
- A caption sentence calling out the peak hour and that morning retention is highest.

### 7. Memory Strength / FSRS card (`FsrsCard`)
- Header: brain icon + "MEMORY STRENGTH" with a tiny "FSRS" superscript + "N mature".
- 3 inner tiles (`--card2`): Avg stability (days), Avg difficulty (%), Retrievability (% predicted retention) — each with an accent icon.
- **"Cards by predicted retention"**: 5 horizontal progress bars, one per retention band, colored with the **red→dark-green heat scale** (see tokens). Each row: right-aligned band label · track bar · count. Bars animate width `.6s`.

### 8. Deck Leaderboard card (`DeckBoardCard`)
- Header: trophy icon + "DECK LEADERBOARD" + period label.
- Ranked rows: rank number · deck name (truncated) + card count · a horizontal progress bar (color cycled per row from the deck palette) · right-aligned time + "NN% ret".

### 9. Personal Records card (`RecordsCard`)
- Header: trophy icon + "PERSONAL RECORDS".
- 3-column grid of tiles (`--card2`), each: accent icon · big value (+ optional unit) · label · sub-caption. Records: Best day, Longest streak, Most time/day, Lifetime cards, Lifetime focus, True retention.

### 10. Achievements card (`AchievementsCard`)
- Header: star icon + "ACHIEVEMENTS" + "N / M unlocked".
- Responsive grid (`auto-fill, minmax(108px,1fr)`). Each badge:
  - **Unlocked**: 64px circle, `color-mix(accent 20%, card2)` fill, 2px accent border, **white icon glyph inside**.
  - **Locked**: a `--text3` progress Ring (stroke 5) showing % toward unlock, with a **white lock icon** centered; caption shows `NN% · description`.
  - Name below + description caption.

---

## Interactions & Behavior
- **Range toggle (Week/Month/Year)**: React state in `App`; passed to Goals, Activity, Answer Buttons, Deck Leaderboard, which recompute aggregates. Default `week`.
- **Activity metric tabs**: local state in `ActivityCard`; switches the trend series and headline metric. Default `total`.
- **Trend / Forecast / Hourly charts**: mouse-move finds nearest data point → vertical dashed crosshair + floating tooltip (title + value). Charts are responsive via a `ResizeObserver` width hook (`useMeasure`), redrawn as SVG.
- **Streak calendar**: ‹ › step month state; next disabled at current month. Each studied day has a hover `title` with card count.
- **Ring animation**: initialises at final value on mount (so a backgrounded iframe paints correctly), animates on value change.
- **Theme / chart-style / corners**: set via `data-*` attributes on `<html>` from a Tweaks panel (prototype-only — see below).
- **Hover states**: nav links, tabs, range buttons, icon buttons, CTA all have hover treatments (see CSS in the HTML file).
- Reduced-motion / print: visible end-state is the base style; the design degrades gracefully without the entrance animations.

## State Management
Prototype state is minimal and local (React `useState`):
- `range`: `'week' | 'month' | 'year'` (App level).
- `tab`: active activity metric (ActivityCard).
- `ym`: `{y, m}` visible month (StreakCard).
- `hover`: hovered data index (each chart).
- Tweak settings (theme/chart/corners) persisted by the prototype's tweak host — **drop this for production** unless you want user-configurable themes; if so wire it to add-on config storage.

In production, replace all of the above's **data inputs** with real queries; the interaction state stays the same.

---

## Data Model (replace synthetic data — `data.js`)
`data.js` builds a deterministic synthetic `window.ANKI` object. In production, build the same shape from the real collection. Shapes consumed by the UI:

- **Daily history** `days[]`: `{ date, dow, studied, reviews, newC, learning, relearning, total, timeSec, again, hard, good, easy, retention, deckSplit{deckName:count}, mature }`. Source: Anki `revlog` + card tables, bucketed per day.
- **`trend(range, metric)`** → 12 weekly / 12 monthly / per-year buckets `{label:Date, value, time, retention}`.
- **`period(range, metric)`** → current period totals `{cards, time, retention, newC, daysStudied, list}`.
- **`goals(range)`** → 4 goal objects `{key,label,value,target,unit,icon}` (targets scale by range). Make targets user-configurable in production ("+ Add a Goal").
- **`streakDays`, `totalSessions`** → consecutive studied days ending today; count of studied days.
- **`forecast[30]`** → `{day, young, mature, total}` cards due per day ahead. Source: Anki scheduler due counts.
- **`fsrs`** → `{stability, difficulty (0..1), retrievability (0..1), mature, young, retr:[{band,n}×5]}`. Source: FSRS scheduler params + retrievability distribution over the collection.
- **`deckBoard(range)`** → per-deck `{name, cards, time, retain}` sorted desc.
- **`records[]`** → `{label, value, unit, sub}` personal bests.
- **`achievements[]`** → `{name, desc, icon, got, progress?}`.
- **Formatting helpers** `fmt`: `fmtDur`, `fmtDurShort` (e.g. `2h 59m`), `compact` (e.g. `2.5k`), `fmtDate`.

> Time values are stored in **seconds**; durations formatted to `Xh Ym` / `Nm`. Numbers ≥1000 shown compact (`k`/`M`) in charts and some stats.

## Assets
- **Fonts**: Google Fonts `Archivo` and `Hanken Grotesk` (Archivo Expanded optional). Bundle them locally for an offline add-on.
- **Icons**: inline SVG stroke set in `icons.jsx` — no external icon dependency, no image files.
- **No raster images / logos** are used. The brand mark is an SVG brain glyph on an accent square.

## Files in this bundle
- `Addonis Maximus.html` — entry point: all theme tokens + global CSS in `<style>`, mounts the React app, loads the scripts below. **Start here for the canonical CSS/tokens.**
- `app.jsx` — App shell: top bar, page header, range toggle, the 12-col grid wiring, and the (prototype-only) Tweaks panel.
- `cards-core.jsx` — `GoalsCard`, `ActivityCard`, `StreakCard`.
- `cards-extra.jsx` — `ForecastCard`, `AnswerButtonsCard`, `HourlyCard`, `FsrsCard`, `DeckBoardCard`, `RecordsCard`, `AchievementsCard`. Contains the FSRS heat-scale and deck-palette color arrays.
- `charts.jsx` — chart primitives: `Ring`, `TrendChart` (area/line/bar + hover), `Bars`, `useMeasure`, `niceCeil`.
- `icons.jsx` — `Icon` stroke-icon component + all path data.
- `data.js` — synthetic data generator + aggregation helpers (**replace with real Anki data**).
- `tweaks-panel.jsx` — prototype-only theme/chart toggles. **Not needed for production** unless you want a settings panel.

### How to run the prototype
Open `Addonis Maximus.html` in a browser (it loads React + Babel from a CDN and transpiles the `.jsx` in-browser). For production, precompile JSX and bundle assets locally — do not rely on in-browser Babel or CDN React.

## Notes for the implementer
1. **Keep green for progress, orange for data.** Goal rings/icons and progress fills are green; charts, active states, and the CTA are orange. The FSRS retention bars use their own red→green heat scale. Don't unify these — the color split is intentional.
2. **Respect the limited add-on space.** The desktop grid is for review; the real panel likely needs the single-column reflow (collapse each card to full width, vertical scroll).
3. **Replace all synthetic data** with real collection queries (revlog, scheduler, FSRS params). Match the data shapes documented above so the components need no structural changes.
4. **No emoji**, stroke-only icons, OKLCH colors, two-font system. Numbers in Archivo, UI in Hanken Grotesk.
