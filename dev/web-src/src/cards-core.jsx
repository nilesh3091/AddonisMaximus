/* Core cards: GoalsCard, ActivityCard, StreakCard. `compact` shrinks sizes for
   the home-screen carousel so it matches the heatmap's density. */
import React from "react";
import { Icon } from "./icons.jsx";
import { Ring, TrendChart } from "./charts.jsx";

const GREEN = "oklch(0.74 0.16 150)"; // progress green (rings/goal glyphs)

function fmtGoal(g, fmt) {
  if (g.unit === "time") return fmt.fmtDurShort(g.value);
  return g.value.toLocaleString();
}

const PERIOD_WORD = { day: "day", week: "week", month: "month", year: "year" };

// The small line under each ring shows the goal's TARGET for the selected view,
// e.g. "10k cards/week", "7h/month", "7 days/year". The target already scales to
// the range (day/week/month/year) in data.js, so we just label which period it is.
// The counted noun comes from the goal's own label ("New cards" -> "72 new cards/week"),
// so two count goals stay distinguishable without an icon inside the ring.
function fmtTarget(g, range, fmt) {
  const per = PERIOD_WORD[range] || "week";
  if (g.unit === "time") {
    const num = fmt.fmtDurShort(g.target).replace(/\s0m$/, ""); // "7h 0m" -> "7h"
    return `${num}/${per}`;
  }
  const num = fmt.compact(g.target).replace(/\.0(?=[kM]$)/, ""); // "10.0k" -> "10k"
  if (g.unit === "days") return `${num} ${num === "1" ? "day" : "days"}/${per}`;
  const noun = (g.label || "cards").toLowerCase(); // "Cards"/"New Cards" -> the counted thing
  return `${num} ${noun}/${per}`;
}

// ============================= GOALS ===================================
// Shared ring row. The Goals card and the tall Dashboard card both render it, so
// a ring, its big number and its "10k cards/week" target line are formatted in
// exactly one place. Every size is a prop because the two cards budget very
// different amounts of vertical space for the same rings.
export function GoalRings({ goals, fmt, range, size, stroke, pctSize, valSize, gap, colGap, labelGap = 3, minCol }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${minCol}px, 1fr))`, gap, alignItems: "center" }}>
      {goals.map((g, i) => {
        const pct = g.target > 0 ? Math.round((g.value / g.target) * 100) : 0;
        return (
          <div key={g.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: colGap }}>
            <Ring value={g.value} max={g.target} size={size} stroke={stroke} delay={i * 120} color={GREEN}>
              <div className="num" style={{ fontSize: pctSize, color: GREEN, lineHeight: 1 }}>{pct}<span style={{ fontSize: "0.55em", marginLeft: 1 }}>%</span></div>
            </Ring>
            <div>
              <div className="num" style={{ fontSize: valSize, lineHeight: 1 }}>{fmtGoal(g, fmt)}</div>
              <div className="label" style={{ marginTop: labelGap, whiteSpace: "nowrap" }}>{fmtTarget(g, range, fmt)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GoalsCard({ anki, range, onAddGoal, compact }) {
  const goals = anki.goals(range);
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="target" size={compact ? 15 : 18} /></span><h2>Goals</h2></div>
        <button className="act" onClick={onAddGoal}>+ Add a Goal</button>
      </div>
      <div className="card-body center">
        {goals.length === 0 ? (
          <div className="empty-hint">No goals yet. <b>+ Add a Goal</b> to start tracking targets for cards, time, and more.</div>
        ) : (
          <GoalRings
            goals={goals} fmt={anki.fmt} range={range}
            size={compact ? 96 : 122} stroke={compact ? 9 : 11}
            pctSize={compact ? 24 : 31}          /* % inside the ring */
            valSize={compact ? 19 : 25}          /* goal number below the ring */
            gap={compact ? 14 : 22} colGap={compact ? 10 : 14}
            labelGap={compact ? 3 : 5} minCol={compact ? 100 : 134} />
        )}
      </div>
    </div>
  );
}

// ============================ ACTIVITY =================================
const TAB_LIST = [
  { key: "total", label: "Total", icon: "layers" },
  { key: "reviews", label: "Reviews", icon: "repeat" },
  { key: "newC", label: "New Cards", icon: "plus" },
  { key: "learning", label: "Learning", icon: "seedling" },
  { key: "relearning", label: "Relearning", icon: "rotate" },
];

export function ActivityCard({ anki, range, chartType, compact }) {
  const [tab, setTab] = React.useState("total");
  const data = anki.trend(range, tab);
  const p = anki.period(range, tab);
  const fmt = anki.fmt;
  const active = TAB_LIST.find((t) => t.key === tab);
  const periodWord = range === "day" ? "Today" : range === "week" ? "This week" : "This month";
  const trendWord = range === "day" ? "Past 14 days" : range === "week" ? "Past 12 weeks" : "Past 12 months";

  return (
    <div className="card">
      <div className="tabs">
        {TAB_LIST.map((t) => (
          <button key={t.key} className={"tab" + (t.key === tab ? " active" : "")} onClick={() => setTab(t.key)}>
            <span className="ti"><Icon name={t.icon} size={compact ? 13 : 15} /></span>{t.label}
          </button>
        ))}
      </div>

      <div className="card-body">
        <div className="label" style={{ fontWeight: 700, color: "var(--text)", fontSize: compact ? 13 : 15, margin: compact ? "14px 0 2px" : "20px 0 2px" }}>{periodWord}</div>
        <div className="stat-row" key={tab + range}>
          <div className="stat fade">
            <div className="label-sm">{active.label}</div>
            <div className="num big">{p.cards.toLocaleString()}</div>
          </div>
          <div className="stat fade" style={{ animationDelay: ".04s" }}>
            <div className="label-sm">Time</div>
            <div className="num big">{fmt.fmtDurShort(p.time)}</div>
          </div>
          <div className="stat fade" style={{ animationDelay: ".08s" }}>
            <div className="label-sm">Retention</div>
            <div className="num big">{Math.round(p.retention * 100)}<span className="u">%</span></div>
          </div>
        </div>

        <div className="label-sm" style={{ margin: compact ? "10px 0 2px" : "14px 0 2px" }}>{trendWord}</div>
        <div className="chart-fill">
          <TrendChart data={data} range={range} type={chartType} fill
            valueFmt={(v) => fmt.compact(Math.round(v))} />
        </div>

        <button className="btn-wide">See more of your progress</button>
      </div>
    </div>
  );
}

// ============================ STREAK ===================================
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Green contribution shades matching the native Anki review-heatmap add-on above.
// Ten steps, not four — the Review Heatmap add-on's "lime" ramp, whose values
// live in styles.css so the light theme can flip the ramp. Index 0 is a day with
// nothing done. Ten steps only pay off with thresholds to match: see `level`.
const HEAT_LEVELS = ["var(--ring-track)",
  "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)", "var(--heat-5)",
  "var(--heat-6)", "var(--heat-7)", "var(--heat-8)", "var(--heat-9)", "var(--heat-10)"];
// Shade thresholds as multiples of a typical day, the trick that makes the same
// add-on's map read so well: scaling to the single busiest day (what we did
// before) lets one cram session flatten a whole year into the bottom shade.
// Floor the average at 20 so a light user's map isn't all top-shade either.
const HEAT_FACTORS = [0.125, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 4.0];

// Layout constants shared by every heat-map. The cell size is derived from the
// width the calendar is handed — so it fills its column instead of leaving a
// ragged margin — and HEAT_MIN_BOX is where shrinking stops and dropping the
// oldest month begins; HEAT_GAP_STRETCH caps how far the gaps between months may
// open up to soak up whatever pixels integer cell sizes leave over.
const HEAT_MIN_BOX = 7;
const HEAT_GAP_STRETCH = 2.4;
// The calendar runs two months past today: ten months of history through the
// current one, then the months ahead. That keeps today clear of the right border
// and leaves room to read what is coming. It is paid for out of history — the
// oldest months are the ones that go, so the whole run stays the same width.
const HEAT_MONTHS = 10;
const HEAT_AHEAD = 2;

// Pure heat-map layout (no hooks): the trailing HEAT_MONTHS months through the
// current one, then HEAT_AHEAD month of days still to come — each a 7-row block.
// Past days are shaded by reviews done; days ahead stay blank like any day with
// nothing done on them, but still carry their due count for the hover read-out.
// Responsive by construction — `box` is the *largest* cell it may use and the grid
// shrinks to keep every month inside `availW` (after reserving `reserveW` for an
// optional side panel), only dropping the oldest month once cells would fall
// below HEAT_MIN_BOX. Returns the chosen `box`/`gap` alongside the scale/label
// helpers. Shared by the Streak card and the combined Activity & Streak card so
// the calendar math lives in exactly one place.
function computeHeatmap(anki, { box: maxBox, cellGap = 3, monthGap, availW, reserveW = 0 }) {
  const TODAY = anki.TODAY;
  const dayMap = {};
  anki.days.forEach((d) => { dayMap[d.date.getUTCFullYear() + "-" + d.date.getUTCMonth() + "-" + d.date.getUTCDate()] = d; });
  // Due-card forecast by day offset from today (day 0 = today), for the days ahead.
  const fc = anki.forecast || [];
  // The current run of study days, so the grid can outline it.
  const runFrom = anki.streakFrom ? anki.streakFrom.getTime() : null;
  const runTo = anki.streakTo ? anki.streakTo.getTime() : null;
  const startMonth = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - (HEAT_MONTHS - 1), 1));
  let maxTotal = 1, studiedTotal = 0, studiedDays = 0;
  const allMonths = [];
  for (let i = 0; i < HEAT_MONTHS + HEAT_AHEAD; i++) {
    const md = new Date(Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + i, 1));
    const y = md.getUTCFullYear(), mo = md.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const lead = (md.getUTCDay() + 6) % 7;          // Mon = 0
    const cols = Math.ceil((lead + daysInMonth) / 7);
    const cells = [];                                // row-major: 7 rows × cols
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < cols; c++) {
        const dayNum = c * 7 + r - lead + 1;
        if (dayNum < 1 || dayNum > daysInMonth) { cells.push(null); continue; }
        const dt = new Date(Date.UTC(y, mo, dayNum));
        const future = dt > TODAY;
        const rec = dayMap[y + "-" + mo + "-" + dayNum];
        const total = rec ? rec.total : 0;
        if (!future && total > maxTotal) maxTotal = total;
        if (!future && total > 0) { studiedTotal += total; studiedDays++; }
        // Days ahead carry their forecast bucket instead of a review record;
        // past the forecast horizon `due` stays null and the cell reads empty.
        const ahead = future ? Math.round((dt - TODAY) / 86400000) : -1;
        const f = ahead >= 0 ? fc[ahead] : null;
        // `rec` rides along so the hover read-out can show time and retention.
        cells.push({ total, future, today: dt.getTime() === TODAY.getTime(), dayNum, date: dt, rec,
          streak: runFrom != null && dt.getTime() >= runFrom && dt.getTime() <= runTo,
          due: f ? f.total : null, dueYoung: f ? f.young : 0, dueMature: f ? f.mature : 0 });
      }
    }
    allMonths.push({ label: MONTHS_SHORT[mo], year: y, cols, cells });
  }
  // ---- responsive fit: solve the cell size for the width we were given ----
  // One equation: availW = reserveW + Σcols·box + Σ(cols−1)·cellGap + slots·gap.
  // Solve for `box` at the base gap; if that lands under HEAT_MIN_BOX the run is
  // too wide for this column, so drop the oldest month and solve again — the
  // month ahead is never the one dropped, since the loop only trims the front.
  const colsOf = (ms) => ms.reduce((a, m) => a + m.cols, 0);
  const innerGapW = (ms) => ms.reduce((a, m) => a + (m.cols - 1), 0) * cellGap;
  const slotsOf = (ms) => Math.max(0, ms.length - 1) + (reserveW ? 1 : 0);
  const solve = (ms) => (availW - reserveW - innerGapW(ms) - slotsOf(ms) * monthGap) / Math.max(1, colsOf(ms));
  let list = allMonths;
  // Trim from the front only, and stop at the current month + the month ahead —
  // squeezing far enough to leave nothing but the future would be nonsense.
  while (list.length > 1 + HEAT_AHEAD && solve(list) < HEAT_MIN_BOX) list = list.slice(1);
  const months = list;
  // Whole pixels keep the grid crisp under the carousel's zoom…
  const box = Math.max(HEAT_MIN_BOX, Math.min(maxBox, Math.floor(solve(months))));
  // …and the rounding remainder is spread across the month gaps so the row still
  // spans its column. Past HEAT_GAP_STRETCH the months would drift apart, so the
  // rest is left as margin and the row is centred instead.
  const slots = slotsOf(months);
  const spare = availW - reserveW - colsOf(months) * box - innerGapW(months) - slots * monthGap;
  const gap = slots > 0 && spare > 0
    ? monthGap + Math.min(monthGap * (HEAT_GAP_STRETCH - 1), spare / slots)
    : monthGap;

  // A typical day = the mean over days actually studied in the visible window.
  const avg = Math.max(20, studiedDays ? Math.round(studiedTotal / studiedDays) : 0);
  const level = (t) => {
    if (t <= 0) return 0;
    for (let i = 0; i < HEAT_FACTORS.length; i++) if (t <= avg * HEAT_FACTORS[i]) return i + 1;
    return HEAT_LEVELS.length - 1;
  };
  const firstY = months.length ? months[0].year : TODAY.getUTCFullYear();
  const lastY = months.length ? months[months.length - 1].year : TODAY.getUTCFullYear();
  const yearLabel = firstY === lastY ? String(lastY) : firstY + "–" + lastY;
  // The single best (most reviews) day among the visible boxes — gets a trophy.
  let best = { total: 0, mi: -1, ci: -1 };
  months.forEach((mn, mi) => mn.cells.forEach((c, ci) => {
    if (c && !c.future && c.total > best.total) best = { total: c.total, mi, ci };
  }));
  return { months, maxTotal, level, yearLabel, best, box, gap, cellGap };
}

// `contain: inline-size` on the measured wrapper (both cards) is load-bearing, not
// a micro-optimisation: the calendar sizes itself to fill the width it measures,
// and the window's card column is a content-sized `1fr` grid track — without
// containment the row's min-content width feeds back into the track, which widens
// the card, which widens the measurement, and the card inflates until the cell
// size hits its ceiling. Containment makes the wrapper's inline size depend only
// on its parent, breaking the loop. It does not clip (that would be `paint`), so
// the tooltip still floats above the grid.
//
// Measure the column the calendar is given. The grid waits for the first real
// measurement (w > 0) so its month count and cell size are right on the first
// paint instead of snapping to a different size after a reflow.
//
// Two triggers, because one is not enough: the observer catches the window being
// resized, and the un-keyed layout effect re-measures after *every* render. The
// second is what makes Settings → Text size work — that only changes the
// carousel's CSS `zoom`, which resizes this column in author pixels while its
// page-pixel box stays put, and a ResizeObserver never fires for that.
function useHeatWidth() {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(0);
  const measure = () => {
    const el = ref.current;
    if (el) setW((prev) => (el.clientWidth && el.clientWidth !== prev ? el.clientWidth : prev));
  };
  React.useLayoutEffect(measure);                   // no deps — every render
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// One day's read-out — the hover/tap tooltip for a heat-map cell. Placed from
// the grid's own layout maths rather than pointer coordinates, which are
// unreliable under the carousel's CSS `zoom` (same rule the charts follow).
function HeatTip({ x, y, w, day, badge, fmt, compact }) {
  const rec = day.rec;
  const ahead = day.future;                          // a day that has not happened yet
  const dateTxt = day.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const n = ahead ? (day.due || 0) : day.total;
  const sub = ahead
    ? (day.dueYoung || day.dueMature ? day.dueYoung + " young · " + day.dueMature + " mature" : "")
    : rec && rec.total
      ? fmt.fmtDurShort(rec.timeSec) + (rec.reviews ? " · " + Math.round(rec.retention * 100) + "% recall" : "")
      : "";
  // Two elements on purpose: the outer one owns the position (its `translate`
  // would otherwise be overwritten by the `fade` keyframes), the inner one fades.
  return (
    <div style={{
      position: "absolute", left: x, top: y, width: w,
      transform: "translate(-50%, -100%)", pointerEvents: "none", zIndex: 6, textAlign: "left",
    }}>
    <div className="fade" style={{
      background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 9,
      padding: compact ? "6px 9px" : "7px 10px", boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    }}>
      {badge ? <div style={{ fontSize: compact ? 8.5 : 9.5, color: badge.color, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{badge.text}</div> : null}
      <div style={{ fontSize: compact ? 9 : 10, color: "var(--text3)", fontWeight: 700, letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{dateTxt}</div>
      {n > 0 ? (
        <div className="num" style={{ fontSize: compact ? 15 : 18, marginTop: 1, whiteSpace: "nowrap" }}>
          {n.toLocaleString()}
          <span style={{ fontSize: compact ? 9.5 : 11, color: "var(--text2)", fontWeight: 600 }}>
            {ahead ? (n === 1 ? " card due" : " cards due") : (n === 1 ? " card" : " cards")}
          </span>
        </div>
      ) : (
        <div style={{ fontSize: compact ? 11 : 13, marginTop: 2, color: "var(--text2)", fontWeight: 700 }}>{ahead ? "Nothing due" : "No reviews"}</div>
      )}
      {sub ? <div style={{ fontSize: compact ? 9 : 10, color: "var(--text3)", fontWeight: 600, marginTop: 1, whiteSpace: "nowrap" }}>{sub}</div> : null}
    </div>
    </div>
  );
}

// The coloured month blocks: 7 rows per month, the best-day trophy, and a hover
// tooltip with the date and the cards done that day. Shared by the Streak card
// and the heat-map panel. `lead` slots an extra block (the Streak card's
// daily-average box) in front of the first month; `onHover`/`onPick` let the
// host mirror or pin the day the pointer is on.
function HeatCalendar({ months, box, cellGap, gap, level, best, compact, fmt, sel, onPick, onHover, lead, leadW = 0 }) {
  // { mi, ci, day } — hovered or tapped. The day itself rides along because the
  // indexes are only valid for the month list that produced them: a resize can
  // drop the oldest month while a tooltip is up, which would otherwise shift every
  // index by one and read out the wrong date.
  const [tip, setTip] = React.useState(null);
  const cellRadius = Math.max(2, Math.round(box * 0.22));
  const labelH = compact ? 11 : 12;
  const labelGap = 5;
  const step = box + cellGap;
  const monthW = (m) => m.cols * box + (m.cols - 1) * cellGap;
  // A trophy under ~10px reads as a smudge; the gold ring alone marks the day.
  const showTrophy = box >= 10;

  // Where each month block starts inside the (shrink-to-fit) row — the tooltip
  // anchors off these instead of reading the DOM or the mouse position.
  const xs = [];
  let acc = lead ? leadW + gap : 0;
  months.forEach((m) => { xs.push(acc); acc += monthW(m) + gap; });
  const rowW = Math.max(0, acc - gap);

  const tipW = compact ? 118 : 134;                 // shared with HeatTip's box
  const hide = () => { setTip(null); if (onHover) onHover(null); };
  const show = (mi, ci, c) => { setTip({ mi, ci, day: c }); if (onHover) onHover(c); };
  // A click never *hides* the read-out: on a mouse the hover has already opened it
  // and toggling would just blink it away; on touch there is no hover, so this is
  // the only thing that opens it. Pinning (the Streak card's info box) is onPick's.
  const pick = (mi, ci, c) => { setTip({ mi, ci, day: c }); if (onPick) onPick(c); };

  const at = tip && months[tip.mi] ? months[tip.mi].cells[tip.ci] : null;
  const day = at && tip.day && at.date.getTime() === tip.day.date.getTime() ? at : null;
  const bestCell = best.mi >= 0 && months[best.mi] ? months[best.mi].cells[best.ci] : null;
  let tipX = 0, tipY = 0;
  if (day) {
    const c = tip.ci % months[tip.mi].cols;
    // Clamp the tooltip's *edges*, not its centre: it is translated by -50%, so a
    // day in the first or last column would otherwise hang half a tooltip outside
    // the row — and get sliced off by the card's overflow:hidden.
    const half = Math.min(tipW / 2, rowW / 2);
    tipX = Math.min(rowW - half, Math.max(half, xs[tip.mi] + c * step + box / 2));
    // Floats clear of the whole calendar rather than over it, so it never hides
    // the neighbouring days — and `translate(-50%, -100%)` means its own height
    // (two lines or three) never needs to be guessed at.
    tipY = -6;
  }

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ position: "relative", display: "inline-flex", gap, alignItems: "flex-start" }}
        onMouseLeave={hide}>
        {lead}
        {months.map((mn, mi) => (
          <div key={mi} style={{ flex: "0 0 auto" }}>
            <div style={{ fontSize: compact ? 8.5 : 9.5, lineHeight: labelH + "px", height: labelH, fontWeight: 700, color: "var(--text3)", marginBottom: labelGap, whiteSpace: "nowrap" }}>{mn.label}</div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${mn.cols}, ${box}px)`, gap: cellGap }}>
              {mn.cells.map((c, ci) => {
                if (c == null) return <div key={ci} style={{ width: box, height: box }} />;
                const isBest = mi === best.mi && ci === best.ci;
                const isSel = sel && !c.future && c.date.getTime() === sel.date.getTime();
                const isTip = day === c;
                // Days ahead are live too, as long as the forecast reaches them.
                const live = !c.future || c.due != null;
                const dateTxt = c.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
                return <div key={ci}
                  className={c.today ? "heat-today" : undefined}
                  onMouseEnter={live ? () => show(mi, ci, c) : undefined}
                  onClick={live ? () => pick(mi, ci, c) : undefined}
                  aria-label={!live ? undefined : c.future ? dateTxt + " — " + c.due + " due"
                    : (c.today ? "Today, " : "") + dateTxt + " — " + c.total + " cards"}
                  style={{
                    width: box, height: box, borderRadius: cellRadius,
                    // a day ahead looks like any day with nothing done on it
                    background: HEAT_LEVELS[c.future ? 0 : level(c.total)],
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: live ? "pointer" : "default",
                    boxShadow: isSel ? "0 0 0 2px var(--accent)"
                      : isTip ? "0 0 0 2px var(--text2)"
                      : isBest ? "0 0 0 1.5px #ffce47"
                      // the current streak, ringed so the run reads as one stretch
                      : c.streak ? "0 0 0 1.5px color-mix(in srgb, var(--accent) 62%, transparent)"
                      : "none",
                  }}>
                    {isBest && showTrophy
                      ? <span style={{ color: "#ffd86b", display: "flex", filter: "drop-shadow(0 1px 1px rgba(0,0,0,.5))" }}><Icon name="trophy" size={Math.round(box * 0.62)} sw={2.2} /></span>
                      : null}
                  </div>;
              })}
            </div>
          </div>
        ))}
        {day ? <HeatTip x={tipX} y={tipY} w={tipW} day={day} fmt={fmt} compact={compact}
          badge={day.today ? { text: "Today", color: "var(--accent)" }
            : day.future ? { text: "Scheduled", color: "var(--text2)" }
            : day === bestCell ? { text: "Best day", color: "#ffce47" } : null} /> : null}
      </div>
    </div>
  );
}

// The Less → More scale, with the year label tucked in front when the card has
// no header of its own to carry it.
function HeatLegend({ compact, yearLabel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: compact ? 10 : 14 }}>
      {yearLabel ? <span className="label-sm" style={{ marginRight: "auto" }}>{yearLabel}</span> : null}
      <span className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>Less</span>
      {/* every other step — eleven swatches would crowd the row */}
      {[0, 2, 4, 6, 8, 10].map((i) => (
        <span key={i} style={{ width: compact ? 9 : 11, height: compact ? 9 : 11, borderRadius: 2, background: HEAT_LEVELS[i] }} />
      ))}
      <span className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>More</span>
    </div>
  );
}

export function StreakCard({ anki, compact, box = 14 }) {
  const [wrapRef, availW] = useHeatWidth();
  const [sel, setSel] = React.useState(null);       // clicked day → pinned in the info box
  const [hov, setHov] = React.useState(null);       // day under the pointer
  const statNum = compact ? 18 : 22;

  // ---- yearly heat map: trailing 12 months, each as its own block ----
  // The fit reserves room on the left for the daily-average box, then sizes the
  // cells to whatever width is left, so the calendar tracks the window.
  const monthGap = compact ? 6 : 8;
  const cellGap = 3;
  const avgBoxW = Math.max(compact ? 66 : 82, Math.round(box * 5.4));
  const heat = availW > 0 ? computeHeatmap(anki, { box, cellGap, monthGap, availW, reserveW: avgBoxW }) : null;
  const gridH = heat ? 7 * heat.box + 6 * heat.cellGap : 7 * box + 6 * cellGap;
  // "Current" daily pace: recent 12-week average cards/day (reuses anki.avgWeekly).
  const dailyAvg = Math.round((anki.avgWeekly ? anki.avgWeekly("total") : 0) / 7) || 0;
  const shown = hov || sel;                          // hover previews, click pins
  const labelH = compact ? 11 : 12;
  const avgBox = (
    <div style={{ flex: "0 0 auto" }}>
      <div style={{ fontSize: compact ? 8.5 : 9.5, lineHeight: labelH + "px", height: labelH, fontWeight: 700, marginBottom: 5, whiteSpace: "nowrap", visibility: "hidden" }}>·</div>
      <div style={{
        width: avgBoxW, height: gridH, minHeight: "min-content", borderRadius: 12, padding: "6px 8px",
        background: "linear-gradient(165deg, var(--card2, var(--bg2)), var(--card))",
        border: "1px solid var(--line)", boxShadow: "0 1px 3px rgba(0,0,0,.14)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, textAlign: "center",
      }}>
        {shown ? (
          <>
            <div style={{ fontSize: compact ? 8 : 9, fontWeight: 800, color: shown.future ? "var(--text2)" : "var(--accent)", letterSpacing: ".06em", textTransform: "uppercase" }}>{shown.date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</div>
            <div className="num" style={{ fontSize: compact ? 21 : 25, lineHeight: 1, fontWeight: 800, color: shown.future ? "var(--text)" : "var(--accent)" }}>{(shown.future ? (shown.due || 0) : shown.total).toLocaleString()}</div>
            <div style={{ fontSize: compact ? 8 : 9, fontWeight: 800, color: "var(--text2)", letterSpacing: ".04em", textTransform: "uppercase" }}>{shown.future ? "cards due" : shown.total === 1 ? "card" : "cards"}</div>
            <div style={{ fontSize: compact ? 7.5 : 8.5, fontWeight: 600, color: "var(--text3)" }}>{shown.date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</div>
          </>
        ) : (
          <>
            <span style={{ color: "var(--accent)", display: "flex" }}><Icon name="flame" size={compact ? 13 : 15} /></span>
            <div className="num" style={{ fontSize: compact ? 21 : 25, lineHeight: 1, fontWeight: 800, color: "var(--accent)" }}>{dailyAvg.toLocaleString()}</div>
            <div style={{ fontSize: compact ? 8 : 9, fontWeight: 800, color: "var(--text2)", letterSpacing: ".04em", textTransform: "uppercase" }}>cards / day</div>
            <div style={{ fontSize: compact ? 7.5 : 8.5, fontWeight: 600, color: "var(--text3)" }}>daily average</div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="card" style={{ position: "relative", overflow: "hidden" }}>
      <div className="card-h">
        <div className="icon-title">
          <span style={{ color: "var(--accent)" }}><Icon name="flame" size={17} /></span>
          <h2>Streak</h2>
          <span className="label-sm" style={{ marginLeft: 2 }}>{heat ? heat.yearLabel : ""}</span>
        </div>
        <button className="act" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="share" size={14} /> Share</button>
      </div>

      <div className="card-body spread">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, marginBottom: compact ? 12 : 16 }}>
          <div style={{ display: "flex", gap: compact ? 22 : 30 }}>
            <div>
              <div className="label-sm" style={{ whiteSpace: "nowrap" }}>Your Streak</div>
              <div className="num" style={{ fontSize: statNum, color: "var(--accent)" }}>{anki.streakDays} <span style={{ fontSize: compact ? 12 : 14, color: "var(--text2)" }}>days</span></div>
            </div>
            <div>
              <div className="label-sm" style={{ whiteSpace: "nowrap" }}>Total Sessions</div>
              <div className="num" style={{ fontSize: statNum }}>{anki.totalSessions.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div ref={wrapRef} style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, minHeight: 0, contain: "inline-size" }}>
          {heat && (
            <HeatCalendar months={heat.months} box={heat.box} cellGap={heat.cellGap} gap={heat.gap}
              level={heat.level} best={heat.best} compact={compact} fmt={anki.fmt}
              sel={sel} onHover={setHov}
              onPick={(c) => setSel((p) => p && p.date.getTime() === c.date.getTime() ? null : c)}
              lead={avgBox} leadW={avgBoxW} />
          )}
          <HeatLegend compact={compact} />
        </div>
      </div>
    </div>
  );
}

// ====================== HEAT-MAP PANEL (no info box) ===================
// The Streak calendar trimmed for the combined card: same coloured grid, hover
// read-out and best-day trophy, but no daily-average info box — it just fills
// its column, measuring its own width so the cells size to whatever it gets.
// `showHeader` off drops the flame/streak line (the Dashboard card already shows
// the streak in its own header) and moves the year label into the legend row, so
// the calendar costs one line less of the height budget.
function HeatmapPanel({ anki, compact, box = 14, showHeader = true }) {
  const [wrapRef, availW] = useHeatWidth();
  const monthGap = compact ? 6 : 8;
  const cellGap = 3;
  const heat = availW > 0 ? computeHeatmap(anki, { box, cellGap, monthGap, availW, reserveW: 0 }) : null;
  return (
    <div ref={wrapRef} style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, minHeight: 0, contain: "inline-size" }}>
      {showHeader && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: compact ? 10 : 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ color: "var(--accent)", display: "flex" }}><Icon name="flame" size={compact ? 14 : 16} /></span>
            <span className="num" style={{ fontSize: compact ? 16 : 20, color: "var(--accent)" }}>{anki.streakDays}</span>
            <span className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>day streak</span>
          </div>
          <span className="label-sm">{heat ? heat.yearLabel : ""}</span>
        </div>
      )}
      {heat && (
        <HeatCalendar months={heat.months} box={heat.box} cellGap={heat.cellGap} gap={heat.gap}
          level={heat.level} best={heat.best} compact={compact} fmt={anki.fmt} />
      )}
      <HeatLegend compact={compact} yearLabel={showHeader ? null : (heat ? heat.yearLabel : "")} />
    </div>
  );
}

// ===================== ACTIVITY & STREAK (combined) ====================
// One card that pairs the trend chart (left half) with the heat-map (right
// half, no info box). The chart half mirrors the Activity card — tabs, the
// period summary, and the trend graph — and tracks the Week/Month/Year toggle.
export function OverviewCard({ anki, range, chartType, compact }) {
  const [tab, setTab] = React.useState("total");
  const data = anki.trend(range, tab);
  const p = anki.period(range, tab);
  const fmt = anki.fmt;
  const active = TAB_LIST.find((t) => t.key === tab);
  const periodWord = range === "day" ? "Today" : range === "week" ? "This week" : "This month";
  const trendWord = range === "day" ? "Past 14 days" : range === "week" ? "Past 12 weeks" : "Past 12 months";
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="layers" size={compact ? 15 : 18} /></span><h2>Activity &amp; Streak</h2></div>
      </div>
      <div className="card-body" style={{ flexDirection: "row", gap: compact ? 18 : 28, minHeight: compact ? 0 : 300 }}>
        {/* LEFT — trend chart */}
        <div style={{ flex: "1 1 50%", minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div className="tabs">
            {TAB_LIST.map((t) => (
              <button key={t.key} className={"tab" + (t.key === tab ? " active" : "")} onClick={() => setTab(t.key)}>
                <span className="ti"><Icon name={t.icon} size={compact ? 13 : 15} /></span>{t.label}
              </button>
            ))}
          </div>
          <div className="label" style={{ fontWeight: 700, color: "var(--text)", fontSize: compact ? 13 : 15, margin: compact ? "12px 0 2px" : "18px 0 2px" }}>{periodWord}</div>
          <div className="stat-row" key={tab + range} style={{ margin: compact ? "8px 0 2px" : "12px 0 2px" }}>
            <div className="stat fade">
              <div className="label-sm">{active.label}</div>
              <div className="num big">{p.cards.toLocaleString()}</div>
            </div>
            <div className="stat fade" style={{ animationDelay: ".04s" }}>
              <div className="label-sm">Time</div>
              <div className="num big">{fmt.fmtDurShort(p.time)}</div>
            </div>
            <div className="stat fade" style={{ animationDelay: ".08s" }}>
              <div className="label-sm">Retention</div>
              <div className="num big">{Math.round(p.retention * 100)}<span className="u">%</span></div>
            </div>
          </div>
          <div className="label-sm" style={{ margin: compact ? "8px 0 2px" : "14px 0 2px" }}>{trendWord}</div>
          <div className="chart-fill">
            <TrendChart data={data} range={range} type={chartType} fill
              valueFmt={(v) => fmt.compact(Math.round(v))} />
          </div>
        </div>
        {/* divider */}
        <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)", flex: "0 0 auto" }} />
        {/* RIGHT — heat-map (no info box) */}
        <div style={{ flex: "1 1 50%", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <HeatmapPanel anki={anki} compact={compact} box={compact ? 13 : 15} />
        </div>
      </div>
    </div>
  );
}

// ============ MULTI VIEW — three stacked blocks, not a card ============
// The panel's "multi" mode (Settings → Appearance → View mode). Instead of one
// card at a time it stacks three blocks: goal rings, the trend graph, the year
// heat-map. The set is fixed for now, but every block is rendered by key through
// `renderBlock`, and `MultiView` takes the list as a prop — so letting the user
// choose what sits in each slot later is a matter of feeding it a different array.
// Slots are keyed by *card* (the same keys as SECTIONS in config.js), so the
// per-slot picker can offer the whole library rather than three block types.
// Three of those cards have a chrome-less "block" rendering that suits the
// stack better than their full card — see renderBlock; the rest fall back to
// the card itself, drawn by the `renderAny` MultiView is handed.
export const MULTI_BLOCKS = ["goals", "activity", "streak"];

function RingsBlock({ anki, range, compact, onAddGoal }) {
  const goals = anki.goals(range);
  if (goals.length === 0) {
    return (
      <div className="empty-hint" style={{ padding: compact ? "8px" : "16px" }}>
        No goals yet. <b className="linky" onClick={onAddGoal}>+ Add a Goal</b> to track cards, time and more.
      </div>
    );
  }
  return (
    <GoalRings
      goals={goals} fmt={anki.fmt} range={range}
      size={compact ? 74 : 94} stroke={compact ? 7 : 9}
      pctSize={compact ? 18 : 23} valSize={compact ? 15 : 19}
      gap={compact ? 10 : 18} colGap={compact ? 7 : 10}
      labelGap={compact ? 2 : 4} minCol={compact ? 84 : 112} />
  );
}

// Tabs get the block's FULL width (not just the graph column) so all five still
// fit at the largest Text size; the period totals sit in a column beside the plot.
function TrendBlock({ anki, range, chartType, compact }) {
  const [tab, setTab] = React.useState("total");
  const data = anki.trend(range, tab);
  const p = anki.period(range, tab);
  const fmt = anki.fmt;
  const active = TAB_LIST.find((t) => t.key === tab) || TAB_LIST[0];
  const trendWord = range === "day" ? "Past 14 days" : range === "week" ? "Past 12 weeks" : "Past 12 months";
  const statNum = compact ? 19 : 25;
  return (
    <div className="dash-trend">
      <div className="dash-trend-h">
        <div className="tabs">
          {TAB_LIST.map((t) => (
            <button key={t.key} className={"tab" + (t.key === tab ? " active" : "")} onClick={() => setTab(t.key)}>
              <span className="ti"><Icon name={t.icon} size={compact ? 12 : 15} /></span>{t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="dash-trend-row">
        <div className="dash-figures" key={tab + range}>
          <div className="stat fade">
            <div className="label-sm">{active.label}</div>
            <div className="num" style={{ fontSize: statNum, lineHeight: 1.1 }}>{p.cards.toLocaleString()}</div>
          </div>
          <div className="stat fade" style={{ animationDelay: ".04s" }}>
            <div className="label-sm">Time</div>
            <div className="num" style={{ fontSize: statNum, lineHeight: 1.1 }}>{fmt.fmtDurShort(p.time)}</div>
          </div>
          <div className="stat fade" style={{ animationDelay: ".08s" }}>
            <div className="label-sm">Retention</div>
            <div className="num" style={{ fontSize: statNum, lineHeight: 1.1 }}>{Math.round(p.retention * 100)}<span className="u">%</span></div>
          </div>
        </div>
        <div className="dash-graph">
          <div className="label-sm dash-trend-word">{trendWord}</div>
          <TrendChart data={data} range={range} type={chartType} height={compact ? 150 : 200}
            valueFmt={(v) => fmt.compact(Math.round(v))} />
        </div>
      </div>
    </div>
  );
}

export function renderBlock(key, ctx) {
  const { anki, range, chartType, compact, onAddGoal, renderAny } = ctx;
  switch (key) {
    case "goals": return <RingsBlock anki={anki} range={range} compact={compact} onAddGoal={onAddGoal} />;
    case "activity": return <TrendBlock anki={anki} range={range} chartType={chartType} compact={compact} />;
    // the streak lives in the panel header, so the calendar drops its own
    case "streak": return <HeatmapPanel anki={anki} compact={compact} box={compact ? 11 : 14} showHeader={false} />;
    // every other card renders as itself; MultiView supplies the renderer so
    // cards-core never has to import cardmap back (that would be a cycle)
    default: return renderAny ? renderAny(key, ctx) : null;
  }
}

// The pencil in a band's corner: swaps which card fills that slot. The menu is
// the full card library, so a slot is not limited to the three that have a
// block rendering; picking a card that already occupies another slot trades
// places with it rather than showing it twice.
function BlockPicker({ current, options, compact, onPick }) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // deferred, so the click that opened the menu does not also close it
    const id = setTimeout(() => document.addEventListener("click", close), 0);
    return () => { clearTimeout(id); document.removeEventListener("click", close); };
  }, [open]);
  return (
    <div className="band-edit-wrap">
      <button className={"band-edit" + (open ? " on" : "")} aria-label="Choose the card for this slot"
        title="Choose a different card" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
        <Icon name="pencil" size={compact ? 12 : 14} />
      </button>
      {open && (
        <div className="band-menu" onClick={(e) => e.stopPropagation()}>
          {options.map((o) => (
            <button key={o.key} className={"band-menu-item" + (o.key === current ? " active" : "")}
              onClick={() => { setOpen(false); onPick(o.key); }}>
              <span className="bi"><Icon name={o.icon} size={13} /></span>
              <span className="bl">{o.label}</span>
              {o.key === current ? <span className="bc"><Icon name="check" size={12} /></span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MultiView({ anki, range, chartType, compact, onAddGoal, blocks = MULTI_BLOCKS, onBlocks, cards = [], renderAny, config, setConfig }) {
  const periodWord = range === "day" ? "Today" : range === "week" ? "This week" : "This month";
  const ctx = { anki, range, chartType, compact, onAddGoal, renderAny, config, setConfig };
  // Picking a card that already sits in another slot swaps the two, so the stack
  // never shows the same card twice.
  const setSlot = (i, key) => {
    if (!onBlocks || blocks[i] === key) return;
    const next = blocks.slice();
    const held = next.indexOf(key);
    if (held >= 0) next[held] = next[i];
    next[i] = key;
    onBlocks(next);
  };
  return (
    <div className="card dash">
      <div className="card-h">
        <div className="icon-title">
          <span style={{ color: "var(--accent)" }}><Icon name="gauge" size={compact ? 15 : 18} /></span>
          <h2>Progress</h2>
          <span className="label-sm" style={{ marginLeft: 2 }}>{periodWord}</span>
        </div>
        <div className="dash-streak">
          <span className="flame"><Icon name="flame" size={compact ? 13 : 15} /></span>
          <span className="num">{anki.streakDays}</span>
          <span className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>day streak</span>
        </div>
      </div>
      <div className="card-body dash-body">
        {blocks.map((k, i) => (
          <div key={k + i} className={"dash-band dash-" + k}>
            {onBlocks && cards.length
              ? <BlockPicker current={k} options={cards} compact={compact} onPick={(next) => setSlot(i, next)} />
              : null}
            {renderBlock(k, ctx)}
          </div>
        ))}
      </div>
    </div>
  );
}
