/* Extra cards: Forecast, AnswerButtons, Hourly, FSRS, DeckBoard, Records,
   Achievements. `compact` shrinks sizes for the home-screen carousel. */
import React from "react";
import { Icon } from "./icons.jsx";
import { Ring, Bars, useBox } from "./charts.jsx";

const DECK_COLORS = [
  "var(--accent)",
  "oklch(0.72 0.13 205)",
  "oklch(0.72 0.14 305)",
  "oklch(0.76 0.15 135)",
  "oklch(0.78 0.13 65)",
];

function Legend({ items }) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text2)", fontWeight: 600 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: it.c }} />{it.label}
          {it.v != null && <span style={{ color: "var(--text)", fontFamily: "var(--font-num)", fontWeight: 700 }}>{it.v}</span>}
        </div>
      ))}
    </div>
  );
}

// ============================ FORECAST =================================
export function ForecastCard({ anki, compact }) {
  const fmt = anki.fmt;
  const data = anki.forecast.map((f) => ({
    x: f.day === 0 ? "Today" : "+" + f.day,
    tip: f.day === 0 ? "Due today" : "In " + f.day + " days",
    young: f.young, mature: f.mature,
  }));
  const dueTomorrow = anki.forecast[1] ? anki.forecast[1].total : 0;
  const weekTotal = anki.forecast.slice(0, 7).reduce((a, f) => a + f.total, 0);
  const stat = compact ? 17 : 22;
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="calendar" size={17} /></span><h2>Forecast</h2></div>
        <span className="label-sm">Next 30 days</span>
      </div>
      <div className="card-body">
        <div style={{ display: "flex", gap: 28, marginBottom: 6 }}>
          <div><div className="label-sm">Due tomorrow</div><div className="num" style={{ fontSize: stat }}>{dueTomorrow}</div></div>
          <div><div className="label-sm">Next 7 days</div><div className="num" style={{ fontSize: stat }}>{weekTotal.toLocaleString()}</div></div>
        </div>
        <div className="chart-fill" style={{ marginTop: 6 }}>
          <Bars data={data} fill segments={["mature", "young"]}
            colors={["var(--accent)", "color-mix(in oklab, var(--accent) 55%, var(--card2))"]}
            valueFmt={(v) => fmt.compact(Math.round(v))} labelEvery={5} />
        </div>
        <Legend items={[{ c: "var(--accent)", label: "Mature" }, { c: "color-mix(in oklab, var(--accent) 55%, var(--card2))", label: "Young" }]} />
      </div>
    </div>
  );
}

// ========================= ANSWER BUTTONS ==============================
export function AnswerButtonsCard({ anki, range, compact }) {
  const p = anki.period(range, "reviews");
  const sum = (k) => p.list.reduce((a, d) => a + d[k], 0);
  const again = sum("again"), hard = sum("hard"), good = sum("good"), easy = sum("easy");
  const total = again + hard + good + easy || 1;
  const segs = [
    { k: "Again", v: again, c: "var(--again)" },
    { k: "Hard", v: hard, c: "var(--hard)" },
    { k: "Good", v: good, c: "var(--good)" },
    { k: "Easy", v: easy, c: "var(--easy)" },
  ];
  const retention = Math.round((total - again) / total * 100);
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="gauge" size={17} /></span><h2>Answer Buttons</h2></div>
        <span className="label-sm">True retention {retention}%</span>
      </div>
      <div className="card-body center">
        <div style={{ display: "flex", height: compact ? 22 : 26, borderRadius: 7, overflow: "hidden", gap: 2 }}>
          {segs.map((s) => (
            <div key={s.k} title={s.k + " " + s.v} style={{ width: s.v / total * 100 + "%", background: s.c, minWidth: s.v ? 2 : 0, transition: "width .5s" }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: compact ? 18 : 24 }}>
          {segs.map((s) => (
            <div key={s.k}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: s.c }} />
                <span className="label" style={{ fontWeight: 700, color: "var(--text)" }}>{s.k}</span>
              </div>
              <div className="num" style={{ fontSize: compact ? 16 : 19, marginTop: 4 }}>{Math.round(s.v / total * 100)}<span style={{ fontSize: 12, color: "var(--text2)" }}>%</span></div>
              <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>{s.v.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================= HOURLY ==================================
export function HourlyCard({ anki, compact }) {
  const [ref, w, boxH] = useBox();
  const hours = anki.hourly;
  const peak = hours.reduce((a, h) => (h.pct > a.pct ? h : a), hours[0]);
  const max = Math.max(...hours.map((h) => h.pct)) || 1;
  const padB = 22, padT = 10;
  const H = boxH > 40 ? boxH : (compact ? 118 : 150);
  const innerH = H - padB - padT;
  const W = Math.max(w, 60);
  const bw = W / 24 * 0.66;
  const fmtH = (h) => (h === 0 ? "12a" : h < 12 ? h + "a" : h === 12 ? "12p" : h - 12 + "p");
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="clock" size={17} /></span><h2>When You Study Best</h2></div>
        <span className="label-sm">Peak {fmtH(peak.hour)}</span>
      </div>
      <div className="card-body">
        <div ref={ref} className="chart-fill" style={{ width: "100%", display: "block" }}>
          {w > 0 && (
            <svg width={W} height={H} style={{ display: "block" }}>
              {hours.map((h, i) => {
                const x = (i + 0.5) * (W / 24);
                const bh = innerH * (h.pct / max);
                const isPeak = h.hour === peak.hour;
                return (
                  <g key={i}>
                    <rect x={x - bw / 2} y={padT + innerH - bh} width={bw} height={Math.max(1, bh)} rx="2.5"
                      fill={isPeak ? "var(--accent)" : "color-mix(in oklab, var(--accent) 28%, var(--card2))"}>
                      <title>{fmtH(h.hour)} · {Math.round(h.retention * 100)}% retention</title>
                    </rect>
                    {h.hour % 3 === 0 && <text x={x} y={H - 6} textAnchor="middle" className="tick" style={{ fontSize: 10 }}>{fmtH(h.hour)}</text>}
                  </g>
                );
              })}
            </svg>
          )}
        </div>
        <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, marginTop: 8 }}>
          You log most reviews around <b style={{ color: "var(--text)" }}>{fmtH(peak.hour)}</b> — and your retention is highest in the morning.
        </div>
      </div>
    </div>
  );
}

// ============================== FSRS ===================================
const FSRS_BAR_COLORS = [
  "oklch(0.62 0.21 25)",
  "oklch(0.72 0.17 55)",
  "oklch(0.83 0.16 95)",
  "oklch(0.74 0.16 150)",
  "oklch(0.5 0.11 150)",
];

export function FsrsCard({ anki, compact }) {
  const f = anki.fsrs;
  const fmt = anki.fmt;
  const retr = f.retr || [];
  const maxR = Math.max(1, ...retr.map((r) => r.n));
  const tiles = [
    { label: "Avg stability", value: f.stability, unit: "days", icon: "shield" },
    { label: "Avg difficulty", value: Math.round(f.difficulty * 100) + "%", unit: "lower=easier", icon: "gauge" },
    { label: "Retrievability", value: Math.round(f.retrievability * 100) + "%", unit: "predicted recall", icon: "brain" },
  ];
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="brain" size={17} /></span><h2>Memory Strength <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700 }}>FSRS</span></h2></div>
        <span className="label-sm">{(f.mature || 0).toLocaleString()} mature</span>
      </div>
      <div className="card-body">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: compact ? 8 : 10, marginBottom: compact ? 12 : 18 }}>
          {tiles.map((t) => (
            <div key={t.label} style={{ background: "var(--card2)", borderRadius: "var(--r-sm)", padding: compact ? "10px 11px" : "12px 13px" }}>
              <div style={{ color: "var(--accent)", marginBottom: compact ? 5 : 7 }}><Icon name={t.icon} size={compact ? 15 : 17} /></div>
              <div className="num" style={{ fontSize: compact ? 17 : 22 }}>{t.value}</div>
              <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, marginTop: 2 }}>{t.label}</div>
            </div>
          ))}
        </div>
        <div className="label-sm" style={{ marginBottom: compact ? 8 : 10 }}>Cards by predicted recall</div>
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 8, flex: "1 1 auto", justifyContent: "space-between" }}>
          {retr.map((r, i) => (
            <div key={r.band} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 56, fontSize: 12, color: "var(--text2)", fontWeight: 600, textAlign: "right" }}>{r.band}</span>
              <div style={{ flex: 1, height: compact ? 12 : 14, background: "var(--card2)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: r.n / maxR * 100 + "%", height: "100%", background: FSRS_BAR_COLORS[i % FSRS_BAR_COLORS.length], borderRadius: 4, transition: "width .6s" }} />
              </div>
              <span className="num" style={{ width: 48, fontSize: 13, textAlign: "right" }}>{fmt.compact(r.n)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========================= DECK LEADERBOARD ============================
export function DeckBoardCard({ anki, range, compact }) {
  const fmt = anki.fmt;
  const rows = anki.deckBoard(range);
  const max = Math.max(...rows.map((r) => r.cards), 1);
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="trophy" size={17} /></span><h2>Deck Leaderboard</h2></div>
        <span className="label-sm">{range === "week" ? "This week" : range === "month" ? "This month" : "This year"}</span>
      </div>
      <div className="card-body spread" style={{ display: "flex", flexDirection: "column", gap: compact ? 10 : 14 }}>
        {rows.map((r, i) => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <span className="num" style={{ width: 18, color: "var(--text3)", fontSize: 14 }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontWeight: 700, fontSize: compact ? 13 : 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 10 }}>{r.name}</span>
                <span className="num" style={{ fontSize: compact ? 13 : 14 }}>{r.cards.toLocaleString()} <span style={{ color: "var(--text3)", fontWeight: 600, fontSize: 12 }}>cards</span></span>
              </div>
              <div style={{ height: 8, background: "var(--card2)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: r.cards / max * 100 + "%", height: "100%", background: DECK_COLORS[i % DECK_COLORS.length], borderRadius: 4, transition: "width .6s" }} />
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: 64 }}>
              <div className="num" style={{ fontSize: 13 }}>{fmt.fmtDurShort(r.time)}</div>
              <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>{Math.round(r.retain * 100)}% ret</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== YOU vs YOU (BEST DAYS) =========================
// Gold / silver / bronze for the top three; accent for the rest.
const MEDAL_COLORS = ["oklch(0.80 0.16 85)", "oklch(0.75 0.03 250)", "oklch(0.67 0.12 55)"];
export function BestDaysCard({ anki, compact }) {
  const fmt = anki.fmt;
  const rows = anki.topDays(5);
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="bolt" size={17} /></span><h2>You vs You</h2></div>
        <span className="label-sm">Your best days</span>
      </div>
      <div className="card-body spread" style={{ display: "flex", flexDirection: "column", gap: compact ? 10 : 14 }}>
        {rows.length === 0 && (
          <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>
            No study days yet — your record board fills in as you review.
          </div>
        )}
        {rows.map((r, i) => {
          const color = MEDAL_COLORS[i] || "var(--accent)";
          return (
            <div key={r.date.getTime()} style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <span className="num" style={{ width: 18, color: i < 3 ? color : "var(--text3)", fontSize: 14, fontWeight: 800 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontWeight: 700, fontSize: compact ? 13 : 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 10 }}>{fmt.fmtDate(r.date)}</span>
                  <span className="num" style={{ fontSize: compact ? 13 : 14 }}>{r.total.toLocaleString()} <span style={{ color: "var(--text3)", fontWeight: 600, fontSize: 12 }}>cards</span></span>
                </div>
                <div style={{ height: 8, background: "var(--card2)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: r.total / max * 100 + "%", height: "100%", background: color, borderRadius: 4, transition: "width .6s" }} />
                </div>
              </div>
              <div style={{ textAlign: "right", minWidth: 64 }}>
                <div className="num" style={{ fontSize: 13 }}>{fmt.fmtDurShort(r.timeSec)}</div>
                <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>{Math.round(r.retention * 100)}% ret</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ======================== DECK MATURITY ETA ============================
// One deck at a time, picked right on the card (persisted in config.maturity;
// "" = largest deck). Projects when the deck reaches ~90% mature from the
// user's own history. Display-only choice — switching never rescans data.
export function MaturityCard({ anki, config, setConfig, compact }) {
  const fmt = anki.fmt;
  const list = anki.projection || [];
  // Offer every deck in the collection — not just the ones the projection could
  // model — so the chooser is always usable and never collapses to static text
  // when only one deck has enough history. Picking an unmodelled deck shows a
  // graceful "not enough history" note rather than doing nothing.
  const deckNames = (anki.allDecks && anki.allDecks.length) ? anki.allDecks : list.map((d) => d.deck);
  const want = (config && config.maturity && config.maturity.deck) || "";
  const p = want ? (list.find((d) => d.deck === want) || null) : (list[0] || null);
  const pickDeck = (deck) => setConfig && setConfig({ ...config, maturity: { ...(config.maturity || {}), deck } });

  // Suspended cards skew this card's "new" pipeline (a big suspended backlog
  // pushes every ETA to "2+ years"), so the include/exclude switch lives right
  // here — it only affects this projection. Toggling config.data triggers a
  // Python recompute (useRecallState), so the numbers refresh in place.
  const excludeSusp = !!(config && config.data && config.data.excludeSuspended);
  const toggleSusp = () => setConfig && setConfig({ ...config, data: { ...(config.data || {}), excludeSuspended: !excludeSusp } });
  const suspToggle = setConfig ? (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, margin: "2px 0 6px" }}>
      <span className="label-sm" style={{ textTransform: "none", letterSpacing: 0, color: "var(--text2)" }}>Exclude suspended</span>
      <button className="switch" data-on={excludeSusp ? "1" : "0"} role="switch" aria-checked={excludeSusp}
        aria-label="Exclude suspended cards" title="Exclude suspended cards from this projection"
        onPointerDown={(e) => e.stopPropagation()} onClick={toggleSusp}><i /></button>
    </div>
  ) : null;

  const header = (
    <div className="card-h">
      <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="seedling" size={17} /></span><h2>Deck Maturity</h2></div>
      {deckNames.length > 1 ? (
        <select className="field" value={want || (p ? p.deck : "")} aria-label="Deck to project"
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => pickDeck(e.target.value)}
          style={{ maxWidth: 170, fontSize: compact ? 11.5 : 12.5, padding: "4px 8px" }}>
          {deckNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      ) : (
        <span className="label-sm" style={{ maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(p && p.deck) || deckNames[0] || ""}</span>
      )}
    </div>
  );

  if (!p) {
    return (
      <div className="card">
        {header}
        <div className="card-body">
          <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, marginBottom: suspToggle ? 10 : 0 }}>
            Not enough history yet — this card fills in once this deck has review history.
          </div>
          {suspToggle}
        </div>
      </div>
    );
  }

  const total = p.mature + p.young + p.new || 1;
  const pct = Math.round((p.mature / total) * 100);
  const done = p.eta90Days != null && p.eta90Days <= 0;
  const series = p.series || [];
  const todayMs = anki.TODAY ? anki.TODAY.getTime() : (series[0] ? series[0].t : 0);

  // data.py ships per-checkpoint dates computed straight off the (uncapped) event
  // model, so even multi-year milestones resolve. Fall back to walking the weekly
  // `series` (which is capped at ~2 years) only if `milestones` is absent.
  const crossMs = (targetCount) => {
    if (p.mature >= targetCount) return todayMs;
    for (let i = 0; i < series.length; i++) {
      if (series[i].mature >= targetCount) {
        if (i === 0) return series[0].t;
        const a = series[i - 1], b = series[i];
        const f = (targetCount - a.mature) / ((b.mature - a.mature) || 1);
        return a.t + (b.t - a.t) * f;
      }
    }
    return null;
  };
  const byPct = {};
  (p.milestones || []).forEach((m) => { byPct[m.pct] = m; });
  const mileMs = (pctTarget, count) => {
    const m = byPct[pctTarget];
    if (m) return m.date != null ? m.date : (m.days != null ? todayMs + m.days * 86400000 : null);
    return crossMs(count);
  };

  // Milestones: "now" plus the 25/50/75/90% mature checkpoints, evenly spaced
  // along the track (positions are by checkpoint, not by time, so a long tail
  // never squashes the early dots).
  const marks = [
    { label: "now", count: p.mature, ms: todayMs, here: true },
    ...[25, 50, 75, 90].map((pctT) => {
      const count = (byPct[pctT] && byPct[pctT].count) || Math.ceil((total * pctT) / 100);
      return { label: pctT + "%", count, ms: mileMs(pctT, count), here: p.mature >= count };
    }),
  ];

  const startLabel = fmt.monYear(new Date(todayMs));
  const eta90Ms = mileMs(90, marks[4].count);
  const endLabel = done ? "Mature 🎉" : eta90Ms == null ? "2+ yrs" : fmt.monthYearFull(new Date(eta90Ms));
  // Span = today -> the (uncapped) 90% date, so it agrees with the finish label
  // instead of snapping to "2+ yrs" the moment the tighter eta90 cap trips.
  const spanDays = eta90Ms == null ? null : Math.round((eta90Ms - todayMs) / 86400000);
  const spanLabel = done ? "done"
    : spanDays == null ? "2+ yrs"
    : spanDays < 60 ? "~" + spanDays + " days"
    : spanDays < 365 ? "~" + Math.round(spanDays / 30) + " mo"
    : "~" + (spanDays / 365).toFixed(1) + " yrs";

  const nodeOuter = compact ? 13 : 16;
  const nodeInner = compact ? 11 : 13;

  return (
    <div className="card">
      {header}
      <div className="card-body">
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 2 }}>
          <div className="num" style={{ fontSize: compact ? 34 : 44, lineHeight: 1 }}>
            {pct}<span style={{ fontSize: compact ? 16 : 20, color: "var(--text2)" }}>%</span>
          </div>
          <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, color: "var(--text2)", fontSize: compact ? 12.5 : 13.5 }}>
            {p.mature.toLocaleString()} of {total.toLocaleString()} mature
          </div>
        </div>
        {suspToggle}

        {/* Milestone track ------------------------------------------------ */}
        <div style={{ position: "relative", margin: compact ? "16px 0 6px" : "22px 0 8px" }}>
          <div style={{ position: "absolute", left: "10%", right: "10%", top: nodeOuter / 2 - 1, height: 2, background: "var(--line)", borderRadius: 2 }} />
          <div style={{ display: "flex" }}>
            {marks.map((m) => (
              <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", minWidth: 0 }}>
                {m.here ? (
                  <span style={{ width: nodeOuter, height: nodeOuter, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 0 4px color-mix(in oklab, var(--accent) 22%, transparent)" }} />
                ) : (
                  <span style={{ width: nodeInner, height: nodeInner, borderRadius: "50%", background: "var(--card)", border: "2px solid var(--text3)", marginTop: (nodeOuter - nodeInner) / 2 }} />
                )}
                <span style={{ marginTop: 8, fontWeight: 800, fontSize: compact ? 12 : 13, color: m.here ? "var(--accent)" : "var(--text)" }}>{m.label}</span>
                <span className="num" style={{ fontSize: compact ? 11.5 : 12.5, color: "var(--text2)", marginTop: 2 }}>{fmt.compact(m.count)}</span>
                <span className="num" style={{ fontSize: compact ? 10.5 : 11.5, color: m.here ? "var(--accent)" : "var(--text3)", marginTop: 3, lineHeight: 1.15 }}>
                  {m.label === "now" ? fmt.monYear(new Date(m.ms)) : m.here ? "✓ done" : m.ms == null ? "—" : fmt.monYear(new Date(m.ms))}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Start → 90% timeline ------------------------------------------ */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: compact ? 10 : 14, paddingTop: compact ? 12 : 14, borderTop: "1px solid var(--border)" }}>
          <span style={{ color: "var(--accent)" }}><Icon name="calendar" size={compact ? 15 : 17} /></span>
          <div>
            <div className="label-sm">Start</div>
            <div className="num" style={{ fontSize: compact ? 14 : 16 }}>{startLabel}</div>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text3)" }}>
            <span style={{ flex: 1, borderTop: "1px dashed var(--line)" }} />
            <span className="label-sm" style={{ textTransform: "none", letterSpacing: 0, whiteSpace: "nowrap" }}>{spanLabel}</span>
            <span style={{ flex: 1, borderTop: "1px dashed var(--line)" }} />
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="label-sm">90% by</div>
            <div className="num" style={{ fontSize: compact ? 14 : 16 }}>{endLabel}</div>
          </div>
          <span style={{ color: "var(--text2)" }}><Icon name="flag" size={compact ? 15 : 17} /></span>
        </div>

        <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, marginTop: compact ? 10 : 12 }}>
          A card here typically matures in <b style={{ color: "var(--text)" }}>~{p.typicalDays} days</b>
          {p.introPerDay > 0 ? <> · you start <b style={{ color: "var(--text)" }}>{p.introPerDay}</b> new/day</> : null}
        </div>
      </div>
    </div>
  );
}

// =========================== RECORDS ===================================
const RECORD_ICONS = ["bolt", "flame", "clock", "layers", "trophy", "target"];
export function RecordsCard({ anki, compact }) {
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="trophy" size={17} /></span><h2>Personal Records</h2></div>
      </div>
      <div className="card-body center">
        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${compact ? 118 : 150}px, 1fr))`, gap: compact ? 8 : 10 }}>
          {anki.records.map((r, i) => (
            <div key={r.label} style={{ background: "var(--card2)", borderRadius: "var(--r-sm)", padding: compact ? "11px 12px" : "13px 14px" }}>
              <div style={{ color: "var(--accent)", marginBottom: compact ? 6 : 8 }}><Icon name={RECORD_ICONS[i % RECORD_ICONS.length]} size={compact ? 15 : 17} /></div>
              <div className="num" style={{ fontSize: compact ? 16 : 21, lineHeight: 1 }}>{r.value}{r.unit ? <span style={{ fontSize: 12, color: "var(--text2)", marginLeft: 4 }}>{r.unit}</span> : null}</div>
              <div className="label" style={{ fontWeight: 700, color: "var(--text)", marginTop: 5 }}>{r.label}</div>
              <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, marginTop: 1 }}>{r.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ======================= MONTH IN REVIEW ==============================
// One calendar month as a full stat sheet — opens on last month, with ‹ › to
// page through history. Counts (reviews/new/learning/relearning), pace (avg
// session, time per card), answer-button breakdown, top decks. Laid out wide
// (stats grid + two columns) to fit the carousel's fixed stage height.
export function MonthCard({ anki, compact }) {
  const fmt = anki.fmt;
  const span = anki.monthSpan || 0;
  // Default to last month; clamp to 0 (this month) when there's no full prior month yet.
  const [off, setOff] = React.useState(Math.max(-1, -span));
  const m = anki.monthStats(off);
  const prev = anki.monthStats(off - 1);
  const canPrev = off > -span;
  const canNext = off < 0;
  const go = (d) => setOff((o) => Math.min(0, Math.max(-span, o + d)));

  // Change vs the previous month. Skipped for the current (partial) month — half
  // a month against a whole one isn't a fair comparison — and when there's no
  // prior data to compare against.
  const delta = (!m.isCurrent && prev.hasData && prev.cards > 0)
    ? Math.round(((m.cards - prev.cards) / prev.cards) * 100) : null;
  const deltaUp = delta != null && delta >= 0;

  // Pace. A "session" here is one study day — revlog has no session boundaries.
  const avgSession = m.daysStudied ? m.time / m.daysStudied : 0;
  const avgPerDay = m.daysStudied ? Math.round(m.cards / m.daysStudied) : 0;
  const perCard = m.cards ? m.time / m.cards : 0;

  const navBtn = (dir, enabled) => (
    <button aria-label={dir < 0 ? "Previous month" : "Next month"} disabled={!enabled}
      onPointerDown={(e) => e.stopPropagation()} onClick={() => go(dir)}
      style={{
        display: "grid", placeItems: "center", width: 26, height: 26, padding: 0,
        borderRadius: 7, border: "1px solid var(--border)", background: "var(--card2)",
        color: enabled ? "var(--text)" : "var(--text3)", cursor: enabled ? "pointer" : "default",
        opacity: enabled ? 1 : 0.45,
      }}>
      <Icon name={dir < 0 ? "chevronL" : "chevronR"} size={15} />
    </button>
  );

  const statGrid = [
    { label: "Reviews", value: m.reviews.toLocaleString() },
    { label: "New cards", value: m.newC.toLocaleString() },
    { label: "Learning", value: m.learning.toLocaleString() },
    { label: "Relearning", value: m.relearning.toLocaleString() },
    { label: "Study time", value: fmt.fmtDurShort(m.time) },
    { label: "Avg session", value: fmt.fmtDurShort(Math.round(avgSession)) },
    { label: "Per card", value: perCard.toFixed(1) + "s" },
    { label: "Retention", value: Math.round(m.retention * 100) + "%" },
  ];

  const btnTotal = m.again + m.hard + m.good + m.easy || 1;
  const segs = [
    { k: "Again", v: m.again, c: "var(--again)" },
    { k: "Hard", v: m.hard, c: "var(--hard)" },
    { k: "Good", v: m.good, c: "var(--good)" },
    { k: "Easy", v: m.easy, c: "var(--easy)" },
  ];

  const decks = (m.decks || []).slice(0, 3);
  const deckSum = (m.decks || []).reduce((a, d) => a + d.cards, 0) || 1;

  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="calendar" size={17} /></span><h2>Month in Review</h2></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {navBtn(-1, canPrev)}
          <span className="num" style={{ fontSize: compact ? 13 : 14, minWidth: compact ? 78 : 86, textAlign: "center", fontWeight: 800 }}>
            {m.label}{m.isCurrent ? <span style={{ color: "var(--text3)", fontWeight: 700, fontSize: 11 }}> · so far</span> : null}
          </span>
          {navBtn(1, canNext)}
        </div>
      </div>
      <div className="card-body spread">
        {!m.hasData ? (
          <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, marginTop: 8 }}>
            No reviews logged in {m.label}. Use ‹ › to find a month you studied.
          </div>
        ) : (
          <>
            {/* Hero: total cards + pace + delta · busiest day on the right */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <div className="num" style={{ fontSize: compact ? 32 : 42, lineHeight: 1 }}>{m.cards.toLocaleString()}</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>
                    cards studied · {avgPerDay.toLocaleString()}/day · {m.daysStudied} of {m.daysElapsed} days
                  </span>
                  {delta != null && (
                    <span className="num" style={{ fontSize: compact ? 12 : 13, fontWeight: 800, color: deltaUp ? "oklch(0.74 0.16 150)" : "var(--text2)", marginTop: 2 }}>
                      {deltaUp ? "▲" : "▼"} {Math.abs(delta)}% vs {fmt.monYear(prev.ref).split(" ")[0]}
                    </span>
                  )}
                </div>
              </div>
              {m.bestDay && (
                <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                  <div className="label-sm" style={{ whiteSpace: "nowrap" }}>Busiest day</div>
                  <div className="num" style={{ fontSize: compact ? 13 : 15, marginTop: 2, whiteSpace: "nowrap" }}>
                    {fmt.fmtDate(m.bestDay.date).replace(/, \d{4}$/, "")} <span style={{ color: "var(--text2)", fontWeight: 600 }}>· {m.bestDay.total.toLocaleString()} cards</span>
                  </div>
                </div>
              )}
            </div>

            {/* Counts + pace grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: compact ? "8px 8px" : "10px 10px", margin: compact ? "12px 0" : "16px 0" }}>
              {statGrid.map((t) => (
                <div key={t.label}>
                  <div className="label-sm" style={{ whiteSpace: "nowrap" }}>{t.label}</div>
                  <div className="num" style={{ fontSize: compact ? 15 : 18, marginTop: 2 }}>{t.value}</div>
                </div>
              ))}
            </div>

            {/* Answer buttons (donut pie) | Top decks — side by side */}
            <div style={{ display: "flex", gap: compact ? 18 : 24, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="label-sm" style={{ marginBottom: compact ? 6 : 8 }}>Answer buttons</div>
                <div style={{ display: "flex", alignItems: "center", gap: compact ? 12 : 16 }}>
                  {(() => {
                    const PIE = compact ? 84 : 104;
                    const stroke = compact ? 17 : 21;
                    const r = (PIE - stroke) / 2;
                    const C = 2 * Math.PI * r;
                    let acc = 0;
                    const arcs = segs.map((s) => { const a = { ...s, frac: s.v / btnTotal, start: acc }; acc += a.frac; return a; });
                    return (
                      <svg width={PIE} height={PIE} style={{ flex: "0 0 auto" }}>
                        <g transform={`rotate(-90 ${PIE / 2} ${PIE / 2})`}>
                          {arcs.map((a) => a.v > 0 && (
                            <circle key={a.k} cx={PIE / 2} cy={PIE / 2} r={r} fill="none" stroke={a.c} strokeWidth={stroke}
                              strokeDasharray={`${Math.max(0.5, a.frac * C - 1.5)} ${C}`} strokeDashoffset={-a.start * C}>
                              <title>{a.k} · {a.v.toLocaleString()} ({Math.round(a.frac * 100)}%)</title>
                            </circle>
                          ))}
                        </g>
                        <text x={PIE / 2} y={PIE / 2 - 1} textAnchor="middle" dominantBaseline="auto"
                          style={{ fill: "var(--text)", fontFamily: "var(--font-num)", fontWeight: 800, fontSize: compact ? 15 : 18 }}>
                          {Math.round(m.retention * 100)}%
                        </text>
                        <text x={PIE / 2} y={PIE / 2 + (compact ? 10 : 12)} textAnchor="middle"
                          style={{ fill: "var(--text3)", fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: compact ? 7.5 : 9, letterSpacing: ".05em", textTransform: "uppercase" }}>
                          retention
                        </text>
                      </svg>
                    );
                  })()}
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: compact ? 5 : 7 }}>
                    {segs.map((s) => (
                      <div key={s.k} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: s.c, flex: "0 0 auto" }} />
                        <span className="label" style={{ fontWeight: 700, color: "var(--text)", fontSize: compact ? 11.5 : 12.5 }}>{s.k}</span>
                        <span className="num" style={{ fontSize: compact ? 12 : 13.5, marginLeft: "auto" }}>
                          {s.v.toLocaleString()} <span style={{ color: "var(--text3)", fontWeight: 600, fontSize: 11 }}>{Math.round(s.v / btnTotal * 100)}%</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {decks.length > 0 && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="label-sm" style={{ marginBottom: compact ? 6 : 8 }}>Top decks</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
                    {decks.map((d, i) => (
                      <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: DECK_COLORS[i % DECK_COLORS.length], flex: "0 0 auto" }} />
                          <span style={{ fontWeight: 700, fontSize: compact ? 11.5 : 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
                        </span>
                        <span className="num" style={{ fontSize: compact ? 11.5 : 12.5, flex: "0 0 auto" }}>
                          {d.cards.toLocaleString()} <span style={{ color: "var(--text3)", fontWeight: 600, fontSize: 10.5 }}>{Math.round(d.cards / deckSum * 100)}%</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ========================= ACHIEVEMENTS ================================
export function AchievementsCard({ anki, compact }) {
  const list = anki.achievements;
  const got = list.filter((a) => a.got).length;
  const circle = compact ? 50 : 64;
  const glyph = compact ? 20 : 26;
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="star" size={17} /></span><h2>Achievements</h2></div>
        <span className="label-sm">{got} / {list.length} unlocked</span>
      </div>
      <div className="card-body center">
        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill,minmax(${compact ? 84 : 108}px,1fr))`, gap: compact ? 9 : 12 }}>
          {list.map((a) => (
            <div key={a.name} style={{ textAlign: "center", opacity: a.got ? 1 : 0.92 }}>
            <div style={{ position: "relative", width: circle, height: circle, margin: compact ? "0 auto 6px" : "0 auto 8px" }}>
              {a.got ? (
                <div style={{
                  width: circle, height: circle, borderRadius: "50%", display: "grid", placeItems: "center",
                  background: "color-mix(in oklab, var(--accent) 20%, var(--card2))", border: "2px solid var(--accent)", color: "#fff",
                }}>
                  <Icon name={a.icon} size={glyph} sw={1.8} />
                </div>
              ) : (
                <Ring value={a.progress || 0} max={1} size={circle} stroke={5} color="var(--text3)">
                  <span style={{ color: "#fff" }}><Icon name="lock" size={compact ? 16 : 20} /></span>
                </Ring>
              )}
            </div>
            <div style={{ fontWeight: 700, fontSize: compact ? 11.5 : 12.5, color: a.got ? "var(--text)" : "var(--text2)" }}>{a.name}</div>
            <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, lineHeight: 1.25, marginTop: 2 }}>
              {a.got ? a.desc : Math.round((a.progress || 0) * 100) + "% · " + a.desc}
            </div>
          </div>
          ))}
        </div>
      </div>
    </div>
  );
}
