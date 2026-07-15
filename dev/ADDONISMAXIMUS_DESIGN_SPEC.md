# Addonis Maximus · Design Reproduction Spec

> Paste this whole document into a fresh chat and ask Claude to rebuild it as a standalone web artifact (React or plain HTML/CSS). It is self-contained: every color, size, and data shape needed to reproduce the UI faithfully is included.

---

## 1. What it is

**Anki** is a popular open-source spaced-repetition flashcard app. Users study "cards" (front/back flashcards) grouped into "decks." Every review is logged, and Anki schedules each card's next appearance using a memory algorithm (the modern one is **FSRS** — it estimates how well you'll remember a card). The app's **home screen** is the **deck browser**: a list of your decks with study counts, and (via a popular community add-on) a GitHub-style **review heatmap** showing daily activity.

**Addonis Maximus** is an add-on that injects a **Strava-style study-progress carousel** directly into that home screen, **below the heatmap**. Think of it as the fitness-app "your week in review" panel, but for studying.

**Design intent:**
- **Motivational** — celebrate streaks, goals, records, achievements (Strava energy).
- **Glanceable** — it lives on the home screen, so each card must read in a second.
- **One card at a time** — a fixed-size carousel; you swipe / click arrows / click dots to move between cards. Never a long scroll.

You are rebuilding **the carousel only** (the add-on also has a full-page "window" dashboard, but it is not the target here). When reproducing, build the **compact / carousel** variant.

---

## 2. The frame / shell

The carousel is a self-contained widget mounted on a host element (`id=addonismaximus-embed`) inside the Anki page. In a standalone artifact, that host is just a `<div>`.

**Structure (top to bottom):**

```
div.embed                       ← root, max-width 680px, margin 6px auto 2px
  div.embed-inner               ← ZOOM container: zoom: var(--embed-zoom, 0.656)
    div.embed-bar               ← top bar: [gear btn] [spacer] [range toggle]
    div.embed-stage             ← FIXED height: var(--embed-stage-h, 320px)
      div.fade                  ← holds exactly ONE card at a time
        (rendered card)
    div.embed-nav               ← footer: [◀ arrow] [• • • dots] [arrow ▶]
```

**Key mechanics:**

- **Fixed-height stage.** `.embed-stage` is locked to **320px** (`--embed-stage-h`). Cards are `height: 100%; overflow: hidden`. Anything taller than 320px (in pre-zoom units) is **clipped** — so design every card to fit. Use width (multi-column) instead of stacking tall. The stage height never changes when you flip cards.
- **Zoom mechanic.** `.embed-inner` uses CSS `zoom: var(--embed-zoom)` (note: `zoom`, *not* `transform: scale` — it keeps paint crisp and keeps layout flow). Base value is **0.656**. The user "Text size" setting multiplies it: `--embed-zoom = 0.656 × textScale` (textScale default 1; presets 0.85 / 1 / 1.2 / 1.4). This scales fonts, rings, charts, and spacing together. Note the 320px stage height is in **pre-zoom** units; on screen the rendered widget is ~210px tall at base zoom.
- **One-card model.** Only one card is in the DOM stage at a time (inside `.fade`). Navigation swaps which card renders. There is no scroll.
- **Navigation:**
  - **Arrows** (`.embed-arrow`) — previous / next. Each is a **34×34px circle** (`border: 1px solid var(--border)`, `background: var(--card)`); disabled state uses `opacity: 0.3`. The chevron icon **inside** is **17px** (the 34px is the button, not the glyph).
  - **Dots** (`.embed-dot`) — one per visible card; the current one has an `active` class.
  - **Swipe** — pointer down → up; horizontal movement **> 45px** triggers next/prev. The stage has `touch-action: pan-y` so vertical scroll still works.
- **Top bar** (`.embed-bar`, flex, `gap: 10px`, `margin-bottom: 12px`):
  - Left: **gear button** (`.gearbtn`, 28×28px) with a **19px** gear icon → opens settings drawer.
  - Center: flexible spacer.
  - Right: **range toggle** (`.range-toggle`) — segmented buttons for day / week / month / year. Which buttons show depends on the current card (see RANGE_CARDS below); the active button uses accent bg + accent-ink text. The chosen range persists in config (`config.ui.range`, default `week`).
- **Default card** on open = `config.sections.defaultCard` (default `overview`); falls back to first visible card.
- **Empty state:** if no cards are enabled, show a hint instead of a blank stage.

**Which cards honor the range toggle:**
- `RANGE_CARDS = { goals, activity, overview, answerButtons, deckBoard }` — these show the toggle.
- `DAY_CARDS = { goals }` — these additionally allow the `day` option.
- The range toggle is **always rendered** — never hidden. On cards that do not honor it, the toggle is shown but **disabled** (`class .range-toggle.disabled`, `opacity: 0.5`, `cursor: not-allowed`). It is greyed out, not removed.

**Shadow-DOM isolation & adopting Anki's background (real add-on behavior — optional in a standalone artifact):**
- The carousel mounts in an **open shadow root** for style isolation; CSS text + the React root are injected inside. Theme tokens live on `:host`.
- It reads Anki's live background colors at runtime (`applyAnkiSurfaces()`): pulls `--canvas` / `--window-bg` (fallback chain → `--canvas-elevated`, `--canvas-inset`, `--frame-bg`, body `backgroundColor`) and sets `--bg`, `--bg2`, then derives surfaces via `color-mix`:
  - `--card = color-mix(in srgb, <base>, #fff 6%)`
  - `--card2 = color-mix(in srgb, <base>, #fff 12%)`
- In a standalone artifact you don't need shadow DOM — just apply the theme tokens (Section 3) to `:root`. The `color-mix` derivation is only needed if you want the widget to blend into a host page; otherwise use the fixed `--card` / `--card2` token values from the chosen theme.

---

## 3. Theme tokens — copy these EXACTLY

> This is the most important section for faithful reproduction. Colors are **OKLCH**. Do not convert to hex or "eyeball" them — paste verbatim. Themes are selected via a `data-theme` attribute (and `data-radius="sharp"` for sharp corners). Default theme is **Strava**.

### Surface, text, accent tokens (per theme)

**STRAVA** — warm dark + orange (default)
| Token | Value |
|---|---|
| `--bg` | `oklch(0.17 0.006 60)` |
| `--bg2` | `oklch(0.13 0.006 60)` |
| `--card` | `oklch(0.215 0.006 60)` |
| `--card2` | `oklch(0.255 0.007 60)` |
| `--border` | `oklch(1 0 0 / 0.07)` |
| `--line` | `oklch(1 0 0 / 0.10)` |
| `--text` | `oklch(0.97 0.004 70)` |
| `--text2` | `oklch(0.74 0.006 70)` |
| `--text3` | `oklch(0.56 0.006 70)` |
| `--accent` | `oklch(0.69 0.196 42)` |
| `--accent2` | `oklch(0.78 0.16 52)` |
| `--accent-ink` | `oklch(0.18 0.02 50)` |
| `--ring-track` | `oklch(1 0 0 / 0.09)` |
| `--glow` | `oklch(0.69 0.196 42 / 0.32)` |

**MIDNIGHT** — cool dark + Anki blue
| Token | Value |
|---|---|
| `--bg` | `oklch(0.18 0.013 255)` |
| `--bg2` | `oklch(0.14 0.014 255)` |
| `--card` | `oklch(0.225 0.015 255)` |
| `--card2` | `oklch(0.27 0.018 255)` |
| `--border` | `oklch(1 0 0 / 0.08)` |
| `--line` | `oklch(1 0 0 / 0.11)` |
| `--text` | `oklch(0.97 0.004 255)` |
| `--text2` | `oklch(0.74 0.012 255)` |
| `--text3` | `oklch(0.56 0.014 255)` |
| `--accent` | `oklch(0.65 0.16 250)` |
| `--accent2` | `oklch(0.74 0.14 248)` |
| `--accent-ink` | `oklch(0.98 0.01 255)` |
| `--ring-track` | `oklch(1 0 0 / 0.09)` |
| `--glow` | `oklch(0.65 0.16 250 / 0.34)` |

**AURORA** — dark + teal-green
| Token | Value |
|---|---|
| `--bg` | `oklch(0.17 0.012 175)` |
| `--bg2` | `oklch(0.13 0.012 175)` |
| `--card` | `oklch(0.215 0.013 175)` |
| `--card2` | `oklch(0.26 0.016 175)` |
| `--border` | `oklch(1 0 0 / 0.08)` |
| `--line` | `oklch(1 0 0 / 0.11)` |
| `--text` | `oklch(0.97 0.006 175)` |
| `--text2` | `oklch(0.74 0.01 175)` |
| `--text3` | `oklch(0.56 0.012 175)` |
| `--accent` | `oklch(0.74 0.15 168)` |
| `--accent2` | `oklch(0.82 0.13 165)` |
| `--accent-ink` | `oklch(0.16 0.03 175)` |
| `--ring-track` | `oklch(1 0 0 / 0.09)` |
| `--glow` | `oklch(0.74 0.15 168 / 0.32)` |

**VIOLET** — dark + purple
| Token | Value |
|---|---|
| `--bg` | `oklch(0.18 0.013 300)` |
| `--bg2` | `oklch(0.14 0.014 300)` |
| `--card` | `oklch(0.225 0.016 300)` |
| `--card2` | `oklch(0.27 0.02 300)` |
| `--border` | `oklch(1 0 0 / 0.08)` |
| `--line` | `oklch(1 0 0 / 0.11)` |
| `--text` | `oklch(0.97 0.005 300)` |
| `--text2` | `oklch(0.74 0.012 300)` |
| `--text3` | `oklch(0.56 0.014 300)` |
| `--accent` | `oklch(0.66 0.17 305)` |
| `--accent2` | `oklch(0.75 0.15 305)` |
| `--accent-ink` | `oklch(0.98 0.01 305)` |
| `--ring-track` | `oklch(1 0 0 / 0.09)` |
| `--glow` | `oklch(0.66 0.17 305 / 0.34)` |

**DAYLIGHT** — light
| Token | Value |
|---|---|
| `--bg` | `oklch(0.96 0.004 70)` |
| `--bg2` | `oklch(0.92 0.005 70)` |
| `--card` | `oklch(1 0 0)` |
| `--card2` | `oklch(0.975 0.004 70)` |
| `--border` | `oklch(0.2 0.01 70 / 0.10)` |
| `--line` | `oklch(0.2 0.01 70 / 0.12)` |
| `--text` | `oklch(0.24 0.01 70)` |
| `--text2` | `oklch(0.46 0.01 70)` |
| `--text3` | `oklch(0.62 0.008 70)` |
| `--accent` | `oklch(0.62 0.2 42)` |
| `--accent2` | `oklch(0.68 0.18 48)` |
| `--accent-ink` | `oklch(1 0 0)` |
| `--ring-track` | `oklch(0.2 0.01 70 / 0.10)` |
| `--glow` | `oklch(0.62 0.2 42 / 0.18)` |

### Semantic "answer button" tokens (shared across all themes)
These represent Anki's four review-answer buttons.
| Token | Value | Meaning |
|---|---|---|
| `--again` | `oklch(0.66 0.19 25)` | "Again" (failed) — red |
| `--hard` | `oklch(0.76 0.15 70)` | "Hard" — amber |
| `--good` | `oklch(0.72 0.16 150)` | "Good" — green |
| `--easy` | `oklch(0.68 0.14 235)` | "Easy" — blue |

### Other hardcoded color palettes (used inside specific cards)
| Constant | Value |
|---|---|
| `GREEN` (Goals ring) | `oklch(0.74 0.16 150)` |
| `HEAT_LEVELS` (streak heatmap, 0→4) | `["var(--ring-track)", "#2e5130", "#3a7d3c", "#4fa84f", "#74c357"]` |
| `FSRS_BAR_COLORS` (retention bands) | `oklch(0.62 0.21 25)`, `oklch(0.72 0.17 55)`, `oklch(0.83 0.16 95)`, `oklch(0.74 0.16 150)`, `oklch(0.5 0.11 150)` |
| `DECK_COLORS` (deck board) | `var(--accent)`, `oklch(0.72 0.13 205)`, `oklch(0.72 0.14 305)`, `oklch(0.76 0.15 135)`, `oklch(0.78 0.13 65)` |
| `MEDAL_COLORS` | gold `oklch(0.80 0.16 85)`, silver `oklch(0.75 0.03 250)`, bronze `oklch(0.67 0.12 55)` |
| Trophy **icon** (streak best day) | `#ffd86b`, shadow `drop-shadow(0 1px 1px rgba(0,0,0,.5))` |
| Best-day **cell** highlight | box-shadow `0 0 0 1.5px #ffce47` (a distinct gold from the trophy icon — note `#ffce47`, not `#ffd86b`) |
| Pending mountain — done fill | `oklch(0.74 0.16 150)` |
| Pending mountain — gold | `oklch(0.80 0.15 85)` |
| Pending kinds | New `oklch(0.70 0.14 250)`, Learning `oklch(0.78 0.15 70)`, Due `oklch(0.74 0.16 150)` |

### Corner radius
| Token | Default | Sharp (`data-radius="sharp"`) |
|---|---|---|
| `--r` | `18px` | `6px` |
| `--r-sm` | `11px` | `4px` |

### Typography
- Font stacks:
  - `--font-num: "Archivo", system-ui, sans-serif` — numerals, big stats, headlines.
  - `--font-ui: "Hanken Grotesk", system-ui, sans-serif` — UI text, labels.
- Sizes (these are **window / full** sizes; the carousel shrinks them — see compact block below):
  | Element | Size | Weight | Notes |
  |---|---|---|---|
  | Page header `h1` (`.phead h1`) | 26px | 800 | letter-spacing -0.03em |
  | Card header `h2` (`.card-h h2`) | 15px | 700 | UPPERCASE, letter-spacing 0.01em |
  | Label (`.label`) | 12.5px | 600 | |
  | Label small (`.label-sm`) | 11.5px | 600 | UPPERCASE, letter-spacing 0.04em |
  | Stat big (`.stat .big`) | 28px | — | line-height 1; unit suffix `.u` 16px/700 |
  | Range toggle buttons | 13.5px | 700 | |
  | Tabs | 13.5px | 700 | |
  | Settings section header | 11.5px | 700 | UPPERCASE, letter-spacing 0.06em |
  | Settings labels / fields | 13.5px | 600 | |

### Spacing / layout
| Token / rule | Value |
|---|---|
| `--maxw` (window column) | 660px |
| `--gap` | 16px |
| `.card` padding (window) | 20px 22px |
| `.card` border | `1px solid var(--border)`, radius `var(--r)`, background `var(--card)` |
| `.card-h` | flex, margin-bottom 16px, gap 12px |
| `.embed` max-width | 680px, margin `6px auto 2px` |
| `.topbar` (window only) | height 46px, padding `0 14px`, gap 14px |

### Compact (carousel) overrides — `.embed …`
These apply only inside the carousel. Apply when building the standalone artifact in carousel mode.
| Selector | Value |
|---|---|
| `.embed-inner` | `zoom: var(--embed-zoom, 0.656)` |
| `.embed-stage` | `height: var(--embed-stage-h, 320px); touch-action: pan-y` |
| `.embed .card` | `height: 100%; overflow: hidden; padding: 14px 16px` |
| `.embed .card-h` | `margin-bottom: 12px` |
| `.embed .card-h h2` | `font-size: 13px` |
| `.embed .card-h .act` | `font-size: 12px` |
| `.embed .stat-row` | `gap: 20px; margin: 12px 0 4px` |
| `.embed .stat .label-sm` | `margin-bottom: 3px` |
| `.embed .stat .big` | `font-size: 17px; font-weight: 600` (unit `.u` 11px/600) |
| `.embed .tabs` | `gap: 6px` |
| `.embed .tab` | `padding: 6px 11px; font-size: 12px` (tab icon svg 13×13) |
| `.embed .label` | `font-size: 11.5px` |
| `.embed .label-sm` | `font-size: 10.5px` |
| `.embed-bar` | flex, gap 10px, margin-bottom 12px |
| `.gearbtn` | 28×28px |
| `.range-toggle` | padding 3px; buttons padding `5px 11px`, font-size 12.5px |

Hover affordances: buttons use `filter: brightness(1.06)`; active tab uses `border-color`/`color: var(--accent)`; active range button uses accent bg + accent-ink text.

**Tab pill styling:** `.tab` has `border: 1.5px solid var(--border)`, `border-radius: 999px`. The active state sets `border-color` **and** `color` to `var(--accent)` — it is an outline + accent text, **not** a filled pill.

---

## 4. Chart primitives — exact geometry

All charts are SVG, theme-aware via CSS vars, and (Trend/Bars) measure their container with a `ResizeObserver` so they fill 100% width. Coordinates use `.toFixed(1)`. Animations are pure CSS transitions. Hover uses transparent SVG hit-rects (immune to the `zoom` coordinate-space issue) plus a React-state-driven HTML tooltip positioned outside the SVG.

**Axis rounding — `niceCeil()`:** chart grid maxima are not the raw data max. Grid max = `niceCeil(max)`, which snaps the leading fraction to the ladder `1 / 2 / 2.5 / 5 / 10` × the appropriate power-of-ten. Grids then label `0 / niceMax/2 / niceMax` of this rounded value (so labels land on round numbers). Wherever this spec says "gridlines at 0/50/100%" or "0, niceMax/2, niceMax", the `niceMax` is this `niceCeil`-rounded value.

### Ring (circular progress)
- Container: `div`, `position: relative`, `size × size` (default **96px**). SVG `width=height=size`, `transform: rotate(-90deg)` (so progress starts at 12 o'clock).
- **Track circle:** `cx=cy=size/2`, `r=(size-stroke)/2` (= 43.5 at defaults), `stroke=var(--ring-track)`, `stroke-width=9`.
- **Progress circle:** same center/radius, `stroke=<color>` (default `var(--accent)`), `stroke-width=9`, `stroke-linecap=round`, `stroke-dasharray=c` where `c=2πr` (circumference), `stroke-dashoffset=c*(1-draw)` where `draw=value/max` clamped 0–1.
- **Glow:** when `value >= max`, apply `filter: drop-shadow(0 0 6px var(--glow))`.
- **Animation:** `transition: stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)`. Mount at final pct, then animate on value change (~30ms+ delay; staggered `delay = i*120ms` when multiple rings).
- **Center overlay:** children absolutely centered (`display: grid; place-items: center`).
- Props: `value, max, size=96, stroke=9, color, delay, children`.

### TrendChart (area / line / bar with hover)
- `div` 100% width, height = `fill ? 100% : 190px`. SVG `W × height`.
- Padding: `padL=6, padR=46, padT=16, padB=26`. Inner: `innerW = W-52`, `innerH = height-42`.
- **Grid:** 3 horizontal lines at `y = [0, niceMax/2, niceMax]` (niceMax = `niceCeil(max)`) mapped into inner area; `stroke=var(--line)`, `stroke-width=1`. Grid value labels: `font-size=11`, `x=W-38`, `y=gridY+4`.
- **X-axis labels:** `font-size=11`, `y=height-7`, text-anchor start/middle/end for first/mid/last. Formatting depends on `range` (week/month/year — month or year display).
- **Area mode:** `<linearGradient id="areaFill">` from `stop-opacity 0.34` (top) → `0.02` (bottom) in accent. Line path `stroke-width=2.6`, `stroke-linejoin/linecap=round`, accent. Data circles: `r=3.4` normal, `r=4.5` last point (unhovered), `r=5` hovered; `stroke=accent`, `stroke-width=2`, `fill=accent` (last point fill = `var(--card)`).
- **Bar mode:** `bw = min(28, innerW/n*0.62)`, `xBar(i) = padL + (i+0.5)*innerW/n`, `rx=3`, opacity transition 0.12s. No circles.
- **Hover line:** vertical, `stroke=var(--text3)`, `stroke-width=1`, `stroke-dasharray="3 3"`. Non-active bars/circles fade to opacity 0.45.
- **Tooltip (HTML div):** `width=120px`, `left = max(8, min(W-130, x-60))`, `background=var(--card2)`, `border=1px var(--border)`, `border-radius=9`, `padding=7px 10px`, `box-shadow=0 8px 24px rgba(0,0,0,.35)`, `z-index=5`. Title `font-size=10.5px`, color `var(--text3)`, weight 700, UPPERCASE, letter-spacing .04em. Value `font-size=18px`, margin-top 2px.
- Props: `data=[{value, label:Date}], height=190, fill, type("area"|"line"|"bar"), range, valueFmt, accent`.

### Bars (vertical, single or stacked)
- `div` 100% width, height = `fill ? 100% : 150px`.
- Padding: `padL=4, padR = axis?40:6, padT=12, padB=22`. Inner: `innerW=W-padR-padL`, `innerH=height-padT-padB`.
- **Grid (only if `axis`):** 3 lines at `[0, niceMax/2, niceMax]` (niceMax = `niceCeil(max)`), `stroke=var(--line)`. Labels `font-size=10.5`, `x=W-padR+7`, `y=gridY+4`.
- **Bars:** `bw = min(26, innerW/n*0.66)`, `xb(i) = padL+(i+0.5)*innerW/n`, `rx=2.5`, opacity transition 0.12s, `fill = colors[segmentIndex]`. Stacked segments stack bottom-up.
- **Hit rect** per group: `x=xb(i)-bw/2-2`, `width=bw+4`, transparent. Hovered group opacity 1, others 0.4.
- **X-axis labels:** shown every `labelEvery` items (default 5), `font-size=10.5`, `y=height-6`, text-anchor middle.
- Props: `data=[{value, x, tip?, [segmentKey]}], height=150, fill, segments(null|keys[]), colors[], valueFmt, labelEvery=5, axis`.

### Icons
Stroke-based set, ~47 icons. All: `viewBox="0 0 24 24"`, default `size=18`, `stroke-width=2`, `stroke=currentColor`, `stroke-linecap/linejoin=round`, `fill=none`, `aria-hidden="true"`. A few override stroke-width (flame 1.4, trophy 2.2). Use any Lucide/Feather-style equivalents: `flame, layers, repeat, target, calendar, clock, gauge, brain, star, infinity, chevronDown/Up/L/R, plus, check, trash, share, rotate, x, seedling, flag, trophy, shield, crown, lock, cards, database, sun, moon, globe, bolt, mountain, gear, eye, eyeOff`.

---

## 5. The cards

Each card is `<div class="card"><div class="card-h">…</div><div class="card-body">…</div></div>`. In carousel mode `compact=true`, which roughly halves dimensions and tightens margins/fonts. Below, sizes are given as `compact / full`.

The literal on-card `<h2>` titles differ from the internal section keys — use the title text below when rebuilding, not the key.

**Lean default — only the first SIX cards are visible by default**; the rest are hidden (toggle-able in settings). `DEFAULT_CONFIG.sections.hidden = SECTIONS.slice(6)`, i.e. only `forecast → maturity` are hidden. **`month` (index 3) and `pending` (index 5) are NOT hidden.** The code comment states it explicitly: *"Default-hide everything past the first 6 (goals, activity, overview, month, streak, pending)."* Default order: `goals, activity, overview, month, streak, pending, forecast, answerButtons, hourly, fsrs, deckBoard, bestDays, records, achievements, maturity`. **Visible-by-default = goals, activity, overview, month, streak, pending**, with `overview` as the opening card.

### 5.1 Goals — *visible by default*
- **Title:** "Goals". Header has a **target icon** (`15 / 18`) and a "+ Add a Goal" button in accent color.
- **Shows:** a grid of circular progress rings, one per goal (e.g. Cards, Study Time, New Cards, Days Studied) vs. its target for the current range.
- **Layout:** `.card-body.center` → CSS grid, auto-wrapping columns `minmax(100 / 134px, 1fr)`, gap `14 / 22`. Each cell: Ring + value (below or centered) + a target-label line.
- **Ring:** size `96 / 122`, stroke `9 / 11`, pct text `24 / 31`, value text `19 / 25`. Ring color = `GREEN` (`oklch(0.74 0.16 150)`). **The same GREEN is used for the ring stroke, the % text inside the ring, AND the goal-editor icon (`.goal-edit-top .gei`)** — not just the ring. Glow when value ≥ target. Staggered animation `delay=i*120ms`.
- **Data:** `anki.goals(range)` → `[{ key, value, target, unit, label, icon, targetMode }]`. Time formatted via short-duration formatter; counts via `toLocaleString()`. Honors range toggle, including `day`. Default goals use `targetMode:'average'`, so each target tracks `anki.avgWeekly(source)` (the recent-12-weeks weekly average), scaled to the period — see Section 6.

### 5.2 Activity — *visible by default*
- **Title:** "Activity".
- **Shows:** study trend over the range plus three summary stats.
- **Layout:** `.card` → `.tabs` (5 buttons: Total, Reviews, New Cards, Learning, Relearning; icons `13 / 15`) → `.card-body` → **period label** (`13 / 15`, bold) → `.stat-row` of 3 stats (cards big number, time short-duration, retention %) with staggered fade-in (animation-delay .04s / .08s) → **trend label** → `.chart-fill` containing a **TrendChart** (area/line/bar per setting) → optional button.
- **Load-bearing UI text:**
  - `periodWord` (the period label) = **"This week" / "This month" / "This year"** for range week/month/year.
  - `trendWord` (the chart label) = **"Past 12 weeks" / "Past 12 months" / "By year"** for range week/month/year.
- **Chart:** TrendChart, padding L6 R46 T16 B26, fills the flex parent (max ~190px), gridlines at `0 / niceMax/2 / niceMax`, accent fill + stroke. **TrendChart buckets are not a fixed window:** week → 12 weekly buckets, month → 12 monthly buckets, year → one bucket per calendar year from the first data year through now.
- **Data:** `anki.trend(range, tab)` → `[{label:Date, value}]`; `anki.period(range, tab)` → `{cards, time, retention}`. Tabs map to keys `total, reviews, newC, learning, relearning`. Honors range toggle.

### 5.3 Overview (Activity & Streak) — *visible by default, OPENING card*
- **Title:** "Activity" (the left half mirrors the Activity card).
- **Shows:** a two-up combining a trend chart (left) and a streak heatmap (right). This is the lean default landing card.
- **Layout:** `.card-body` with `flex-direction: row`, gap `18 / 28`. **Left 50%:** mirrors the Activity card (tabs, period/trend labels, 3 stats, TrendChart in `.chart-fill`) but with independent tab state. **Vertical divider:** 1px `var(--border)`. **Right 50%:** a `HeatmapPanel` — a stripped-down Streak (no info box, no click-to-inspect). `minHeight: 0 (compact) / 300px (full)`. Chart label margins `12 / 18` vertical.
- **Heatmap cell size:** `OverviewCard` passes `box={compact ? 13 : 15}` to `HeatmapPanel`, so the embedded carousel uses **13px** cells on the right half (15px in window mode). (This is distinct from the standalone Streak card, which uses 17px in the carousel — see 5.4.)
- **Data:** same as Activity (left) + same as Streak (right). Honors range toggle.

### 5.4 Streak — *visible by default*
- **Title:** "Streak". Header has a flame icon, a year label, and a Share button.
- **Shows:** a GitHub-style **heatmap** of the trailing 12 months, current streak, total sessions, and a daily-average box; click a day to inspect it.
- **Layout:** `.card` (relative, overflow hidden) → `.card-h` (flame/icon + title + year label + Share button) → `.card-body.spread` → stats row (streak days / total sessions, stat text `18 / 22`) → flex-grow wrap → heatmap grid: a **daily-average box** then **12 month blocks**, each block = a month label (`8.5 / 9.5`) above a **7-row × N-col** grid of day cells.
- **Cells (carousel):** the carousel renders the Streak card with **`box=17`** (`embed.jsx` sets `ctx.streakBox = 17`; `cardmap` passes `box={streakBox}` to `StreakCard`). `14` is only the `StreakCard` function default and is **not** what the carousel uses. Gap `3px` (fixed), radius `Math.max(2, box*0.22)` (≈ 4px at box=17). Mon = row 0. Heat color by level via `HEAT_LEVELS`.
  - **Heat-level formula:** `t<=0 ? 0 : t<max*0.25 ? 1 : t<max*0.5 ? 2 : t<max*0.75 ? 3 : 4` (where `max` = max daily total over visible window).
- **Daily-average box:** width `Math.max(66 / 82, box*5.4)`, height = `7×box + 6×gap`. **At box=17 these derive from 17, not 14** (gridH = `7*17 + 6*3 = 137`; avgBoxW = `max(66, 17*5.4) ≈ 91.8`). Gradient bg (`var(--card2)`→`var(--card)`), 1px border, 12px radius, shadow `0 1px 3px`. Shows daily-avg "cards/day" (label `8 / 9`). The daily average is derived as `Math.round(anki.avgWeekly("total") / 7)` — i.e. the weekly average divided by 7 (see Section 6).
- **Best day** (highest count in visible 12mo): trophy icon `9 / 10`, color `#ffd86b` + drop-shadow, plus a `0 0 0 1.5px #ffce47` golden box-shadow on the cell (note the cell gold `#ffce47` differs from the trophy icon gold `#ffd86b`).
- **Interaction:** click a non-future day to select; the avg-box then shows that date + its card count (selected-day label `21 / 25`). `ResizeObserver` fits months to available width.
- **Data:** `anki.days` → `[{date, total}]`; `anki.TODAY, anki.streakDays, anki.totalSessions, anki.avgWeekly("total")`. Trailing 12 months, UTC calendar math, date key `year-mo-day`. Streak counts back from today; not-yet-studied today does not reset it.

### 5.5 Forecast — *hidden by default*
- **Title:** "Forecast", header-right "Next 30 days".
- **Shows:** upcoming due-card load (next ~30 days), stacked mature vs. young.
- **Layout:** **Bars** chart, stacked (`mature` + `young`). X labels `'Today'` / `'+N'`. Stat font `17 / 22`.
- **Segment colors:** `colors = ["var(--accent)", "color-mix(in oklab, var(--accent) 55%, var(--card2))"]` — segment 0 (**mature**) is solid accent; segment 1 (**young**) is an accent/card2 mix (not a separate token).
- **Data:** `anki.forecast` → `[{day, young, mature, total}]`.

### 5.6 Answer Buttons — *hidden by default*
- **Title:** "Answer Buttons", header-right "True retention {n}%".
- **Shows:** distribution of Again / Hard / Good / Easy answers + computed retention.
- **Layout:** a horizontal stacked bar (`height 22 / 26`) using `--again/--hard/--good/--easy`, plus a 4-column grid of percentages (gap `18 / 24`, value font `16 / 19`).
- **Data:** `period(range,'reviews').list` → `[{again, hard, good, easy}]` summed. Honors range toggle.

### 5.7 Hourly — *hidden by default*
- **Title:** "When You Study Best", header-right "Peak {h}".
- **Shows:** 24-hour study-pattern bar chart, peak hour highlighted.
- **Layout:** SVG bar chart, height `H = 118 / 150`, bar width = `W/24*0.66`. Peak bar = `var(--accent)`; others = `color-mix(in oklab, var(--accent) 28%, var(--card2))`.
- **Data:** `anki.hourly` → `[{hour, pct, retention}]` (24 entries).

### 5.8 FSRS — *hidden by default*
- **Title:** "Memory Strength" with a small "FSRS" superscript; header-right "{n} mature". Section label above the bars: "Cards by predicted retention".
- **Shows:** memory-model metrics — stability, difficulty, retrievability — plus a breakdown of cards by retention band.
- **Layout:** 3 stat tiles, tile font `17 / 22`, padding `10px 11px / 12px 13px`, gap `8 / 10`:
  - **Avg stability** — unit `days`.
  - **Avg difficulty** — rendered as a **percentage**: `Math.round(f.difficulty * 100) + "%"`, unit `lower=easier`. So `difficulty` is a **0..1 fraction** (real sample `0.31` → "31%"), **not** a 1..10 scale.
  - **Retrievability** — unit `predicted retention`, rendered as a percentage.
  - Then horizontal bars, one per retention band (bar height `12 / 14`), scaled to the max band count, colored by `FSRS_BAR_COLORS[i % 5]`.
- **Bands (labels exactly):** `['<70%', '70–80%', '80–90%', '90–95%', '95%+']`.
- **Data:** `anki.fsrs` → `{stability, difficulty, retrievability, mature, retr:[{band, n}]}` (`difficulty` and `retrievability` are 0..1 fractions).

### 5.9 DeckBoard — *hidden by default*
- **Title:** "Deck Leaderboard". A **trophy appears once, in the card header** — there is no per-row trophy.
- **Shows:** a leaderboard of decks ranked by study volume in the range.
- **Layout:** ranked rows (row gap `10 / 14`). Each row = a **rank number** (1, 2, 3…) in `var(--text3)`, the deck name (`13 / 14`), a horizontal bar in `DECK_COLORS`, and time/retain.
- **Data:** `anki.deckBoard(range)` → `[{name, cards, time, retain}]`. Note `r.time` is computed as `cards * 9` seconds in `data.js` `deckBoard()`. Honors range toggle.

### 5.10 Records (bestDays/records) — *hidden by default*
- **Title:** "Personal Records" (records) / "You vs You" with "Your best days" (bestDays).
- **Shows:** lifetime personal records / "best days" as a grid of metric tiles.
- **Layout:** auto-fit grid, `grid-template-columns: repeat(auto-fit, minmax(118 / 150px, 1fr))`, tile padding `11px 12px / 13px 14px`, icon `15 / 17`, number font `16 / 21`. Icons rotate through `bolt, flame, clock, layers, trophy, target`.
- **Tile render order:** `r.value` (a **pre-formatted string**) → `r.unit` → a **label** line → a **`sub`** line (`label-sm`). So each record needs `{ icon, label, value (string), unit, sub }`. A numeric `value` plus a unit like `'pct'`/`'sec'` would render literally (e.g. "0.97pct") and leave the `sub` line blank.
- **Data:** `anki.records` (6 lifetime stats, e.g. `{ label, value:'412', unit:'cards', sub:'Jun 4, 2026' }`) and/or `anki.topDays(5)` → `[{date, total, timeSec, retention}]`.

### 5.11 Achievements — *hidden by default*
- **Title:** "Achievements".
- **Shows:** a grid of badges; unlocked badges filled, locked ones show a progress ring.
- **Layout:** grid `repeat(auto-fill, minmax(84 / 108px, 1fr))`, gap `9 / 12`. Each badge: a circle `50 / 64px`.
  - **Unlocked:** `2px solid var(--accent)` border **plus** a tinted fill background `color-mix(in oklab, var(--accent) 20%, var(--card2))`, white icon (`color: #fff`), icon `stroke-width: 1.8`.
  - **Locked:** a `Ring(value=progress, max=1, stroke=5, color var(--text3))` with a **white lock icon**.
- **Data:** `anki.achievements` → `[{name, icon, got, progress, desc}]` (12 badges).

### (Also exist: `month`, `pending` visible by default; `maturity` default-hidden)
- **Pending** (key `pending`, **visible by default**) — title "Pending Today". Animated SVG "mountain" burn-down of today's remaining vs. done (circle glyph `50 / 64`, mountain height `140 / 176`); kinds New/Learning/Due. Data: `anki.pending` + last day's split (needs the per-day `deckSplit` / `studied` fields, see Section 6).
- **Month** (key `month`, **visible by default**) — title "Month in Review". Full month stats grid (`repeat(4,1fr)`). Data: `anki.monthStats(offset)`.
- **Maturity** (key `maturity`, **default-hidden**) — title "Deck Maturity". A substantial card: a **percent-mature hero** number, a **5-node milestone track** (now / 25 / 50 / 75 / 90%), a **Start → 90% timeline** with calendar/flag icons, an **Exclude-suspended toggle**, and a **deck `<select>`**. Tracks the deck in `config.maturity.deck` (`""` = auto / largest deck).

---

## 6. Demo data (copy-pasteable)

The real add-on builds `raw` from the Anki collection, then `buildAnki(raw, config)` wraps it with helpers. For a standalone artifact, hardcode an `anki` object exposing the helper API the cards call. Below is a **concrete, realistic** sample shaped from the data contract (`raw` = `{today, decks, days[], hourly[24], forecast[30], fsrs, records, achievements, pending, projection}`). Five sample decks: `日本語 Core, Anatomy, Pharmacology, Algorithms, Spanish`. "Today" = Jun 4, 2026 UTC midnight (`1748092800000`). Retention = `(reviews - again) / reviews`.

**Important `days[]` shape:** each per-day record carries many fields the cards depend on — `studied, reviews, newC, learning, relearning, total, timeSec, again, hard, good, easy, retention, deckSplit{name:count}, mature, dow`. In particular `studied` (boolean — drives streak/sessions counts) and `deckSplit` (per-deck counts — drives DeckBoard / Month / Pending) must be present. The demo below includes them.

```js
// ---- helper formatters ----
const fmtDurShort = s => {           // 25200 -> "7h", 5400 -> "1h 30m"
  const h = Math.floor(s/3600), m = Math.round((s%3600)/60);
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};
const num = n => n.toLocaleString();

// ---- 365 days of synthetic daily records ending today ----
const DAY = 86400000, TODAY = 1748092800000;
const DECKS = ['日本語 Core', 'Anatomy', 'Pharmacology', 'Algorithms', 'Spanish'];
const DECK_W = [0.34, 0.24, 0.18, 0.14, 0.10];
const days = Array.from({length: 365}, (_, i) => {
  const date = TODAY - (364 - i) * DAY;
  const wd = new Date(date).getUTCDay();
  const skip = (wd === 0 && i % 3 === 0);            // occasional rest days
  const base = skip ? 0 : 90 + Math.round(60 * Math.sin(i / 9)) + (i % 7) * 8;
  const total = Math.max(0, base);
  const again = Math.round(total * 0.12);
  const reviews = Math.round(total * 0.82);
  return {
    date,
    studied: total > 0,                             // drives streak / sessions
    total,
    reviews,
    newC: Math.round(total * 0.14),
    learning: Math.round(total * 0.03),
    relearning: again,
    again,
    hard: Math.round(reviews * 0.12),
    good: Math.round(reviews * 0.62),
    easy: Math.round(reviews * 0.14),
    retention: reviews ? (reviews - again) / reviews : 0,
    mature: 4000 + i,
    dow: wd,
    timeSec: total * 7,                             // ~7s per card
    deckSplit: Object.fromEntries(                  // per-deck counts for the day
      DECKS.map((n, k) => [n, Math.round(total * DECK_W[k])])),
  };
});

const raw = {
  today: TODAY,
  decks: DECKS,

  days,

  hourly: Array.from({length: 24}, (_, h) => ({      // peak around 21:00
    hour: h,
    pct: Math.max(0, Math.round(100 * Math.exp(-Math.pow(h - 21, 2) / 18))),
    retention: 0.86 + 0.05 * Math.cos(h / 4),
  })),

  forecast: Array.from({length: 30}, (_, d) => {
    const mature = Math.max(0, 70 - d * 2 + (d % 5) * 6);
    const young  = Math.max(0, 40 - d + (d % 3) * 5);
    return { day: d, mature, young, total: mature + young };
  }),

  fsrs: {
    stability: 47.3,        // avg days
    difficulty: 0.31,       // 0..1 fraction -> renders "31%"
    retrievability: 0.91,   // 0..1 fraction -> renders "91%"
    mature: 4120,
    retr: [
      { band: '<70%',   n: 180  },
      { band: '70–80%', n: 540  },
      { band: '80–90%', n: 1430 },
      { band: '90–95%', n: 2110 },
      { band: '95%+',   n: 2680 },
    ],
  },

  // value is a PRE-FORMATTED STRING; sub is a second label line.
  records: [
    { icon: 'bolt',   label: 'Best day',        value: '412',     unit: 'cards', sub: 'Jun 4, 2026'  },
    { icon: 'flame',  label: 'Longest streak',  value: '213',     unit: 'days',  sub: 'ended May 2025'},
    { icon: 'clock',  label: 'Most time / day', value: '2h 30m',  unit: '',      sub: 'Apr 12, 2026' },
    { icon: 'layers', label: 'Lifetime cards',  value: '184,230', unit: 'cards', sub: 'since 2023'    },
    { icon: 'trophy', label: 'Best retention',  value: '97%',     unit: '',      sub: 'week of Mar 3' },
    { icon: 'target', label: 'Total sessions',  value: '947',     unit: '',      sub: 'all time'      },
  ],

  achievements: [
    { name: 'First Week',   icon: 'calendar', got: true,  progress: 1,    desc: '7 days studied' },
    { name: 'Centurion',    icon: 'shield',   got: true,  progress: 1,    desc: '100-day streak' },
    { name: 'Night Owl',    icon: 'moon',     got: true,  progress: 1,    desc: 'Study after midnight' },
    { name: 'Early Bird',   icon: 'sun',      got: false, progress: 0.4,  desc: 'Study before 6am' },
    { name: '10k Club',     icon: 'layers',   got: true,  progress: 1,    desc: '10,000 reviews' },
    { name: 'Polyglot',     icon: 'globe',    got: false, progress: 0.6,  desc: '3 language decks' },
    { name: 'Perfectionist',icon: 'star',     got: false, progress: 0.85, desc: '95% retention week' },
    { name: 'Marathon',     icon: 'mountain', got: false, progress: 0.5,  desc: '500 cards in a day' },
    { name: 'Scholar',      icon: 'brain',    got: true,  progress: 1,    desc: '1,000 mature cards' },
    { name: 'Relentless',   icon: 'infinity', got: false, progress: 0.7,  desc: '365-day streak' },
    { name: 'Crowned',      icon: 'crown',    got: false, progress: 0.3,  desc: 'Top deck mastery' },
    { name: 'Seedling',     icon: 'seedling', got: true,  progress: 1,    desc: 'Plant your first deck' },
  ],

  pending: [
    { deck: '日本語 Core', new: 20, learn: 8,  review: 90 },
    { deck: 'Anatomy',     new: 10, learn: 4,  review: 55 },
    { deck: 'Pharmacology',new: 5,  learn: 2,  review: 30 },
  ],
};

// ---- aggregation helpers the cards call (minimal stand-in for buildAnki) ----
// Real RANGE_MULT scales a WEEKLY base to the period (NOT a per-day count).
const RANGE_MULT  = { day: 1/7, week: 1, month: 4.3, year: 52 };
const RANGE_DAYS  = { day: 1, week: 7, month: 31, year: 365 };
const sliceRange  = r => days.slice(-RANGE_DAYS[r]);
const sumKey      = (arr, k) => arr.reduce((s, d) => s + (d[k] || 0), 0);
const sumSource   = (arr, src) =>
  src === 'time'        ? sumKey(arr, 'timeSec') :
  src === 'daysStudied' ? arr.filter(d => d.studied).length :
                          sumKey(arr, src);

const anki = {
  TODAY,
  streakDays: 41,
  totalSessions: days.filter(d => d.studied).length,   // counts studied days
  matureCount: 4120,
  lifetimeCards: 184230,
  days,
  fmt: { fmtDurShort, num },

  fsrs: raw.fsrs,
  forecast: raw.forecast,
  hourly: raw.hourly,
  records: raw.records,
  achievements: raw.achievements,
  pending: raw.pending,

  // avgWeekly(source): WEEKLY average over up to the last 12 COMPLETE weeks
  // (excludes the current partial week). NOT a per-day average.
  avgWeekly(source = 'total') {
    const last12w = days.slice(-(12 * 7 + (new Date(TODAY).getUTCDay() || 7)));
    // simple stand-in: last 84 complete days -> weekly mean
    const list = last12w.slice(0, 84);
    const weeks = Math.max(1, list.length / 7);
    return sumSource(list, source) / weeks;
  },

  trend(range, tab) {                             // [{label:Date, value}]
    const key = { total:'total', reviews:'reviews', newC:'newC',
                  learning:'learning', relearning:'relearning' }[tab] || 'total';
    return sliceRange(range).map(d => ({ label: new Date(d.date), value: d[key] }));
  },

  period(range, tab) {                            // {cards, time, retention}
    const arr = sliceRange(range);
    const key = { total:'total', reviews:'reviews', newC:'newC',
                  learning:'learning', relearning:'relearning' }[tab] || 'total';
    const reviews = sumKey(arr, 'reviews'), again = sumKey(arr, 'again');
    return {
      cards: sumKey(arr, key),
      time: sumKey(arr, 'timeSec'),
      retention: reviews ? (reviews - again) / reviews : 0,
    };
  },

  // matches DEFAULT_CONFIG.goals: targetMode 'average' -> target tracks the
  // recent weekly average for the source, scaled by RANGE_MULT to the period.
  goals(range) {
    const arr  = sliceRange(range);
    const mult = RANGE_MULT[range] != null ? RANGE_MULT[range] : 1;
    const mk = (key, label, source, unit) => {
      const value      = sumSource(arr, source);
      const weeklyBase = this.avgWeekly(source);          // 'average' mode
      const target     = Math.max(1, Math.round(weeklyBase * mult));
      return { key, label, source, unit, value, target, targetMode: 'average' };
    };
    return [
      mk('cards', 'Cards',        'total',       'count'),
      mk('time',  'Study Time',   'time',        'time'),
      mk('new',   'New Cards',    'newC',        'count'),
      mk('days',  'Days Studied', 'daysStudied', 'days'),
    ];
  },

  deckBoard(range) {                              // ranked decks (synthetic split)
    const total = this.period(range, 'total').cards;
    return DECKS.map((name, i) => {
      const cards = Math.round(total * DECK_W[i]);
      return { name, cards, time: cards * 9, retain: 0.93 - i * 0.02 }; // time = cards*9
    });
  },

  topDays(n = 5) {
    return [...days].sort((a, b) => b.total - a.total).slice(0, n)
      .map(d => ({ date: d.date, total: d.total, timeSec: d.timeSec,
                   retention: d.reviews ? (d.reviews - d.again) / d.reviews : 0 }));
  },
};
```

The six default cards (Goals, Activity, Overview, Month, Streak, Pending) render fully from this. Tune `noise`/sine factors for different curve shapes; bump the `days` length (the real sample is 1155 days = ~3 years) for a fuller heatmap.

---

## 7. Settings (gear drawer)

A right-side modal drawer (scrim overlay; slides in via cubic-bezier; **Esc** closes). Four **collapsible** sections (all collapsed by default). On every change, call `setConfig(newConfig)` — in a standalone artifact, persist to `localStorage`.

**Drawer dimensions / animation:**
- `.drawer` — `width: min(440px, 100vw)`, `border-left: 1px solid var(--border)`, `box-shadow: -12px 0 40px rgba(0,0,0,.4)`. Animates in via `slidein`: `translateX(100%) → 0` over `.24s cubic-bezier(.2,.8,.2,1)`.
- `.scrim` — `z-index: 2147483646`; `.drawer` — `z-index: 2147483647` (above the scrim, both near the max int so the drawer floats over any host page).

**Header:** gear icon + "Settings" title + close (×) button.

**Section: Appearance**
- Theme dropdown: `THEMES = [strava "Strava (orange)", midnight "Midnight (blue)", aurora "Aurora (teal)", violet "Violet (purple)", daylight "Daylight (light)"]`.
- Text size dropdown: `TEXT_SIZES = [0.85 "Small", 1 "Default", 1.2 "Large", 1.4 "Extra large"]` (this is `textScale`; `--embed-zoom = 0.656 × textScale`).
- Chart: segmented `Area / Bars`.
- Corners: segmented `Round / Sharp` (sets `data-radius`).

**Section: Sections** (card management)
- Default-card dropdown (cannot pick a hidden card).
- A list of all cards, each with: icon, name, up/down reorder buttons, eye / eye-off visibility toggle. Hidden cards get a dimmed `sec-item hidden` style.

**Section: Goals** (`GoalEditor` rows)
- Each row: label input, icon, source dropdown, Average/Custom (fixed) toggle, weekly-target input, delete. "+ Add goal" appends a row. The goal-editor icon (`.goal-edit-top .gei`) uses the GREEN `oklch(0.74 0.16 150)`.
- Source change auto-updates the unit. `GOAL_SOURCES = [total "Cards studied" (count), reviews "Reviews" (count), newC "New cards" (count), time "Study time" (time), daysStudied "Days studied" (days)]`.
- Average mode shows the live weekly average (`anki.avgWeekly(g.source)`); Custom (fixed) mode shows the input.

**Section: Data**
- Day rollover hour: `auto` (null) or 0–23 (rendered "12 AM" … "11 PM").
- Mature threshold days (1–365).
- Streak min cards (1–9999).
- Include-decks: checkbox per deck (empty list = all decks).
- Exclude-suspended cards toggle (`data.excludeSuspended`, default `false`).

**DEFAULT_CONFIG (full):**
```js
const SECTIONS_ORDER = ['goals','activity','overview','month','streak','pending',
  'forecast','answerButtons','hourly','fsrs','deckBoard','bestDays','records',
  'achievements','maturity'];

const DEFAULT_CONFIG = {
  version: 1,
  appearance: { theme: 'strava', chart: 'area', corners: 'round', textScale: 1 },
  sections: {
    order: SECTIONS_ORDER,
    // Default-hide everything past the first 6 (goals, activity, overview,
    // month, streak, pending). => slice(6) = forecast..maturity.
    hidden: SECTIONS_ORDER.slice(6),  // ['forecast','answerButtons','hourly',
                                      //  'fsrs','deckBoard','bestDays','records',
                                      //  'achievements','maturity']
    defaultCard: 'overview',
  },
  goals: [
    { key:'cards', label:'Cards',        icon:'layers', source:'total',        unit:'count', targetMode:'average', weeklyTarget:1200 },
    { key:'time',  label:'Study Time',   icon:'clock',  source:'time',         unit:'time',  targetMode:'average', weeklyTarget:25200 },
    { key:'new',   label:'New Cards',    icon:'plus',   source:'newC',         unit:'count', targetMode:'average', weeklyTarget:120 },
    { key:'days',  label:'Days Studied', icon:'check',  source:'daysStudied',  unit:'days',  targetMode:'average', weeklyTarget:7 },
  ],
  data: { includeDecks: [], cutoffHour: null, matureThresholdDays: 21,
          streakMinCards: 1, excludeSuspended: false },
  maturity: { deck: '' },           // '' = auto (largest deck)
  ui: { range: 'week' },
};
```
CSS class hooks: `scrim, drawer, drawer-h, drawer-body, set-sect (+open/closed), set-sect-h, set-sect-body, set-row, set-label, set-desc, seg, switch, sec-item (+hidden), goal-edit, goal-edit-top (.gei), goal-edit-grid`.

**Toggle switch geometry (`.switch`):** `40 × 23px` track. Thumb `i` is `17 × 17px`, positioned at `top/left: 3px`. ON state moves the thumb via `transform: translateX(17px)` and sets the track `background: var(--accent)`; OFF state uses `background: var(--ring-track)`. Animates via background-color + thumb `transform`.

---

## 8. Reproduction checklist / tips

- **Fixed 320px stage, overflow hidden.** This is the #1 trap. The stage never resizes; tall content is clipped. Design each card to fit 320px (pre-zoom) — go wide (columns) not tall. Cards are `height:100%`.
- **`zoom`, not `transform: scale`.** Apply `zoom: 0.656 × textScale` to `.embed-inner`. Using `scale` breaks layout flow and (notably) SVG hover hit-testing coordinates — that's why charts use transparent SVG hit-rects.
- **OKLCH colors verbatim.** Don't convert to hex or approximate. The whole palette is OKLCH; paste the exact values per theme. Modern browsers support `oklch()` and `color-mix()` natively.
- **One card at a time.** The stage holds a single card; arrows/dots/swipe (>45px) swap it. No vertical list, no scroll. Arrow buttons are 34×34px circles; the chevron inside is 17px.
- **Compact ternaries everywhere.** Carousel = `compact:true`, which shrinks rings (96 vs 122), strokes (9 vs 11), fonts, gaps, paddings. Don't ship full-size numbers in the carousel.
- **Lean default = first SIX.** Show Goals, Activity, Overview, Month, Streak, Pending by default; Overview opens first. Everything from `forecast` onward (forecast, answerButtons, hourly, fsrs, deckBoard, bestDays, records, achievements, maturity) is settings-gated. `month` and `pending` are NOT hidden.
- **Two fonts.** Archivo for numbers/headlines, Hanken Grotesk for UI. Load both (Google Fonts) or the system-ui fallback will look noticeably off.
- **Heat-level math is exact:** `t<=0?0 : t<max*0.25?1 : t<max*0.5?2 : t<max*0.75?3 : 4`, colors `["var(--ring-track)","#2e5130","#3a7d3c","#4fa84f","#74c357"]`, Mon=0, 7 rows. **Carousel Streak cell = 17px** (Overview's embedded heatmap = 13px), gap 3px, radius `max(2, box*0.22)`.
- **Ring starts at 12 o'clock** via `transform: rotate(-90deg)`; animate `stroke-dashoffset` (1.1s, `cubic-bezier(.2,.8,.2,1)`), glow when `value>=max`. Goals rings use GREEN for the stroke AND the % text.
- **Range toggle is card-aware but always rendered.** Only `goals/activity/overview/answerButtons/deckBoard` honor it; only `goals` allows `day`. Elsewhere the toggle is shown but **disabled** (`.range-toggle.disabled`, opacity .5, not-allowed) — never hidden.
- **`niceCeil` axis rounding.** Grid maxima snap to `1/2/2.5/5/10 × 10ⁿ`; labels read `0 / niceMax/2 / niceMax` of the rounded value.
- **Use the literal `<h2>` titles**, not the section keys (e.g. FSRS = "Memory Strength", hourly = "When You Study Best", deckBoard = "Deck Leaderboard", bestDays = "You vs You", pending = "Pending Today", month = "Month in Review", maturity = "Deck Maturity").
- **`days[]` needs `studied` + `deckSplit`.** Streak/sessions count `studied` days; DeckBoard/Month/Pending read `deckSplit`. FSRS `difficulty`/`retrievability` are 0..1 fractions rendered as %. Records `value` is a pre-formatted string with a `sub` second line.
- **Charts need a measured width.** TrendChart/Bars use a ResizeObserver — give them a parent with a real/100% width or they render empty.
