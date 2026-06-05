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
function fmtTarget(g, fmt) {
  if (g.unit === "time") return "of " + fmt.fmtDurShort(g.target);
  return "of " + g.target.toLocaleString();
}

// ============================= GOALS ===================================
export function GoalsCard({ anki, range, onAddGoal, compact }) {
  const goals = anki.goals(range);
  const fmt = anki.fmt;
  const ringSize = compact ? 74 : 104;
  const ringStroke = compact ? 8 : 10;
  const ringIcon = compact ? 19 : 26;
  const valSize = compact ? 16 : 22;
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="target" size={compact ? 15 : 18} /></span><h2>Goals</h2></div>
        <button className="act" onClick={onAddGoal}>+ Add a Goal</button>
      </div>
      {goals.length === 0 ? (
        <div className="empty-hint">No goals yet. <b>+ Add a Goal</b> to start tracking targets for cards, time, and more.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${compact ? 92 : 130}px, 1fr))`, gap: compact ? 8 : 14 }}>
          {goals.map((g, i) => {
            const pct = Math.min(1, g.target ? g.value / g.target : 0);
            return (
              <div key={g.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: compact ? 6 : 10 }}>
                <Ring value={g.value} max={g.target} size={ringSize} stroke={ringStroke} delay={i * 120} color={GREEN}>
                  <span style={{ color: GREEN }}><Icon name={g.icon} size={ringIcon} sw={1.8} /></span>
                </Ring>
                <div>
                  <div className="num" style={{ fontSize: valSize, lineHeight: 1 }}>{fmtGoal(g, fmt)}</div>
                  <div className="label" style={{ marginTop: compact ? 2 : 4, whiteSpace: "nowrap" }}>{g.label}</div>
                  <div className="label-sm" style={{ marginTop: compact ? 2 : 3, textTransform: "none", letterSpacing: 0, whiteSpace: "nowrap" }}>
                    {Math.round(pct * 100)}% {fmtTarget(g, fmt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
      <TrendChart data={data} range={range} type={chartType} height={compact ? 140 : 188}
        valueFmt={(v) => fmt.compact(Math.round(v))} />

      <button className="btn-wide">See more of your progress</button>
    </div>
  );
}

// ============================ STREAK ===================================
const DOW_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function StreakCard({ anki, compact }) {
  const dayMap = React.useMemo(() => {
    const m = {};
    anki.days.forEach((d) => { m[d.date.getUTCFullYear() + "-" + d.date.getUTCMonth() + "-" + d.date.getUTCDate()] = d; });
    return m;
  }, [anki]);
  const TODAY = anki.TODAY;
  const [ym, setYm] = React.useState({ y: TODAY.getUTCFullYear(), m: TODAY.getUTCMonth() });
  const first = new Date(Date.UTC(ym.y, ym.m, 1));
  const daysInMonth = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayKey = TODAY.getUTCFullYear() + "-" + TODAY.getUTCMonth() + "-" + TODAY.getUTCDate();
  const monthLabel = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const streakWeeks = Math.floor(anki.streakDays / 7);

  const canNext = !(ym.y === TODAY.getUTCFullYear() && ym.m === TODAY.getUTCMonth());
  const step = (dir) => setYm((s) => {
    let m = s.m + dir, y = s.y;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    return { y, m };
  });

  const statNum = compact ? 18 : 22;
  return (
    <div className="card" style={{ position: "relative", overflow: "hidden" }}>
      <div className="card-h">
        <div className="icon-title">
          <button className="iconbtn" onClick={() => step(-1)} aria-label="prev month"><Icon name="chevronL" size={16} /></button>
          <h2 style={{ textTransform: "none", fontSize: compact ? 15 : 17 }}>{monthLabel}</h2>
          <button className="iconbtn" onClick={() => step(1)} disabled={!canNext} style={{ opacity: canNext ? 1 : 0.3 }} aria-label="next month"><Icon name="chevronR" size={16} /></button>
        </div>
        <button className="act" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="share" size={14} /> Share</button>
      </div>

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
        <div style={{
          display: "flex", alignItems: "center", gap: compact ? 6 : 8, flex: "0 0 auto",
          background: "var(--accent)", color: "#fff", borderRadius: 999,
          padding: compact ? "5px 11px 5px 9px" : "7px 14px 7px 11px", boxShadow: "0 6px 18px var(--glow)",
        }}>
          <Icon name="flame" size={compact ? 16 : 20} fill="#fff" sw={1.4} />
          <div style={{ lineHeight: 1 }}>
            <div className="num" style={{ fontSize: compact ? 15 : 18, color: "#fff" }}>{streakWeeks}</div>
            <div style={{ fontSize: 8.5, fontWeight: 800, opacity: .8, letterSpacing: ".05em", color: "rgba(255, 255, 255, 0)" }}>WK STREAK</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: compact ? 5 : 7, maxWidth: compact ? 360 : undefined, margin: compact ? "0 auto" : undefined, width: "100%" }}>
        {DOW_LABELS.map((d, i) => <div key={i} className="label-sm" style={{ textAlign: "center" }}>{d}</div>)}
        {cells.map((d, i) => {
          if (d == null) return <div key={i} />;
          const key = ym.y + "-" + ym.m + "-" + d;
          const rec = dayMap[key];
          const isToday = key === todayKey;
          const future = new Date(Date.UTC(ym.y, ym.m, d)) > TODAY;
          const done = rec && rec.studied;
          return (
            <div key={i} title={done ? rec.total + " cards" : ""} style={{
              aspectRatio: "1", borderRadius: "50%", display: "grid", placeItems: "center",
              fontSize: compact ? 11 : 12.5, fontWeight: 700, fontFamily: "var(--font-num)",
              background: done ? "var(--accent)" : "transparent",
              color: done ? "#fff" : future ? "var(--text3)" : "var(--text2)",
              border: done ? "none" : isToday ? "2px solid var(--accent)" : "1.5px solid var(--border)",
              boxShadow: isToday && !done ? "0 0 0 2px var(--glow)" : "none",
            }}>
              {done ? <Icon name="brain" size={compact ? 12 : 15} /> : d}
            </div>
          );
        })}
      </div>
    </div>
  );
}
