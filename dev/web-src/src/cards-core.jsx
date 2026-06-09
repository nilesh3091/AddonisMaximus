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
export function GoalsCard({ anki, range, onAddGoal, compact }) {
  const goals = anki.goals(range);
  const fmt = anki.fmt;
  const ringSize = compact ? 96 : 122;
  const ringStroke = compact ? 9 : 11;
  const pctSize = compact ? 24 : 31;   // % inside the ring
  const valSize = compact ? 19 : 25;   // goal number below the ring
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
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${compact ? 100 : 134}px, 1fr))`, gap: compact ? 14 : 22, alignItems: "center" }}>
            {goals.map((g, i) => {
              const pct = g.target > 0 ? Math.round((g.value / g.target) * 100) : 0;
              return (
              <div key={g.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: compact ? 10 : 14 }}>
                <Ring value={g.value} max={g.target} size={ringSize} stroke={ringStroke} delay={i * 120} color={GREEN}>
                  <div className="num" style={{ fontSize: pctSize, color: GREEN, lineHeight: 1 }}>{pct}<span style={{ fontSize: "0.55em", marginLeft: 1 }}>%</span></div>
                </Ring>
                <div>
                  <div className="num" style={{ fontSize: valSize, lineHeight: 1 }}>{fmtGoal(g, fmt)}</div>
                  <div className="label" style={{ marginTop: compact ? 3 : 5, whiteSpace: "nowrap" }}>{fmtTarget(g, range, fmt)}</div>
                </div>
              </div>
              );
            })}
          </div>
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
  const periodWord = range === "week" ? "This week" : range === "month" ? "This month" : "This year";
  const trendWord = range === "week" ? "Past 12 weeks" : range === "month" ? "Past 12 months" : "By year";

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
const HEAT_LEVELS = ["var(--ring-track)", "#2e5130", "#3a7d3c", "#4fa84f", "#74c357"];

export function StreakCard({ anki, compact, box = 14 }) {
  const wrapRef = React.useRef(null);
  const [availW, setAvailW] = React.useState(560);
  const [sel, setSel] = React.useState(null);       // clicked day → { date, total }
  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setAvailW(el.clientWidth || 560);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const dayMap = React.useMemo(() => {
    const m = {};
    anki.days.forEach((d) => { m[d.date.getUTCFullYear() + "-" + d.date.getUTCMonth() + "-" + d.date.getUTCDate()] = d; });
    return m;
  }, [anki]);
  const TODAY = anki.TODAY;
  const statNum = compact ? 18 : 22;

  // ---- yearly heat map: trailing 12 months, each as its own block ----
  const startMonth = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - 11, 1));
  let maxTotal = 1;
  const allMonths = [];
  for (let i = 0; i < 12; i++) {
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
        const rec = dayMap[y + "-" + mo + "-" + dayNum];
        const total = rec ? rec.total : 0;
        if (total > maxTotal) maxTotal = total;
        cells.push({ total, future: dt > TODAY, dayNum, date: dt });
      }
    }
    allMonths.push({ label: MONTHS_SHORT[mo], year: y, cols, cells });
  }
  // Bigger boxes ⇒ fewer months fit, so the grid fills the width with larger
  // squares. Keep the trailing (most recent) months that fit at this box size.
  const monthGap = compact ? 6 : 8;
  const cellGap = 3;
  const gridH = 7 * box + 6 * cellGap;              // height of a 7-row month grid
  const avgBoxW = Math.max(compact ? 66 : 82, Math.round(box * 5.4));
  // Reserve room for the daily-average box on the left, then keep the most recent
  // months that still fit — this drops the oldest month(s) to make space for the box.
  const months = (function fit() {
    const shown = [];
    let used = avgBoxW;
    for (let i = allMonths.length - 1; i >= 0; i--) {
      const m = allMonths[i];
      const mw = m.cols * box + (m.cols - 1) * cellGap;
      if (used + monthGap + mw > availW) break;
      used += monthGap + mw; shown.unshift(m);
    }
    return shown;
  })();
  const level = (t) => t <= 0 ? 0 : t < maxTotal * 0.25 ? 1 : t < maxTotal * 0.5 ? 2 : t < maxTotal * 0.75 ? 3 : 4;
  const firstY = months.length ? months[0].year : TODAY.getUTCFullYear();
  const lastY = months.length ? months[months.length - 1].year : TODAY.getUTCFullYear();
  const yearLabel = firstY === lastY ? String(lastY) : firstY + "–" + lastY;
  const cellRadius = Math.max(2, Math.round(box * 0.22));
  // "Current" daily pace: recent 12-week average cards/day (reuses anki.avgWeekly).
  const dailyAvg = Math.round((anki.avgWeekly ? anki.avgWeekly("total") : 0) / 7) || 0;
  // Find the single best (most reviews) day among the visible boxes — gets a trophy.
  let best = { total: 0, mi: -1, ci: -1 };
  months.forEach((mn, mi) => mn.cells.forEach((c, ci) => {
    if (c && !c.future && c.total > best.total) best = { total: c.total, mi, ci };
  }));
  return (
    <div className="card" style={{ position: "relative", overflow: "hidden" }}>
      <div className="card-h">
        <div className="icon-title">
          <span style={{ color: "var(--accent)" }}><Icon name="flame" size={17} /></span>
          <h2>Streak</h2>
          <span className="label-sm" style={{ marginLeft: 2 }}>{yearLabel}</span>
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

        <div ref={wrapRef} style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 0 }}>
          <div style={{ display: "flex", gap: monthGap, alignItems: "flex-start", justifyContent: "center" }}>
            {/* Daily-average box — sits where the oldest month used to be */}
            <div style={{ flex: "0 0 auto" }}>
              <div style={{ fontSize: compact ? 8.5 : 9.5, fontWeight: 700, marginBottom: 5, whiteSpace: "nowrap", visibility: "hidden" }}>·</div>
              <div style={{
                width: avgBoxW, height: gridH, borderRadius: 12, padding: "6px 8px",
                background: "linear-gradient(165deg, var(--card2, var(--bg2)), var(--card))",
                border: "1px solid var(--line)", boxShadow: "0 1px 3px rgba(0,0,0,.14)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, textAlign: "center",
              }}>
                {sel ? (
                  <>
                    <div style={{ fontSize: compact ? 8 : 9, fontWeight: 800, color: "var(--accent)", letterSpacing: ".06em", textTransform: "uppercase" }}>{sel.date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</div>
                    <div className="num" style={{ fontSize: compact ? 21 : 25, lineHeight: 1, fontWeight: 800, color: "var(--accent)" }}>{sel.total.toLocaleString()}</div>
                    <div style={{ fontSize: compact ? 8 : 9, fontWeight: 800, color: "var(--text2)", letterSpacing: ".04em", textTransform: "uppercase" }}>{sel.total === 1 ? "card" : "cards"}</div>
                    <div style={{ fontSize: compact ? 7.5 : 8.5, fontWeight: 600, color: "var(--text3)" }}>{sel.date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</div>
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
            {months.map((mn, mi) => (
              <div key={mi} style={{ flex: "0 0 auto" }}>
                <div style={{ fontSize: compact ? 8.5 : 9.5, fontWeight: 700, color: "var(--text3)", marginBottom: 5, whiteSpace: "nowrap" }}>{mn.label}</div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${mn.cols}, ${box}px)`, gap: cellGap }}>
                  {mn.cells.map((c, ci) => {
                    if (c == null) return <div key={ci} style={{ width: box, height: box }} />;
                    const isBest = mi === best.mi && ci === best.ci;
                    const isSel = sel && !c.future && c.date.getTime() === sel.date.getTime();
                    return <div key={ci}
                      onClick={c.future ? undefined : () => setSel((p) => p && p.date.getTime() === c.date.getTime() ? null : { date: c.date, total: c.total })}
                      title={c.future ? "" : (isBest ? "Best day — " : "") + c.total + " cards"}
                      style={{
                        width: box, height: box, borderRadius: cellRadius,
                        background: c.future ? "transparent" : HEAT_LEVELS[level(c.total)],
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: c.future ? "default" : "pointer",
                        boxShadow: isSel ? "0 0 0 2px var(--accent)" : isBest ? "0 0 0 1.5px #ffce47" : "none",
                      }}>
                        {isBest
                          ? <span style={{ color: "#ffd86b", display: "flex", filter: "drop-shadow(0 1px 1px rgba(0,0,0,.5))" }}><Icon name="trophy" size={Math.round(box * 0.62)} sw={2.2} /></span>
                          : null}
                      </div>;
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 14 }}>
            <span className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>Less</span>
            {HEAT_LEVELS.map((bg, i) => (
              <span key={i} style={{ width: compact ? 9 : 11, height: compact ? 9 : 11, borderRadius: 2, background: bg }} />
            ))}
            <span className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
