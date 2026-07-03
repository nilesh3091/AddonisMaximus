/* Extra cards: Forecast, AnswerButtons, Hourly, You-vs-You, Deck maturity,
   Pending today. `compact` shrinks sizes for the carousel. */
import React from "react";
import { Icon } from "./icons.jsx";
import { Bars, useBox, useMeasure } from "./charts.jsx";

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

// ===================== YOU vs YOU (BEST DAYS) =========================
// A leaderboard of your biggest study days: gold/silver/bronze medals for the
// podium, a highlighted leader row, the card score, and each day's time · recall.
const MEDAL = [
  { fill: "linear-gradient(145deg, oklch(0.88 0.15 92), oklch(0.71 0.15 66))", ink: "oklch(0.26 0.03 70)" },
  { fill: "linear-gradient(145deg, oklch(0.90 0.02 250), oklch(0.70 0.02 250))", ink: "oklch(0.26 0.01 250)" },
  { fill: "linear-gradient(145deg, oklch(0.79 0.12 55), oklch(0.58 0.12 44))", ink: "oklch(0.97 0.02 60)" },
];
export function BestDaysCard({ anki, compact }) {
  const fmt = anki.fmt;
  const rows = anki.topDays(5);
  const badge = compact ? 30 : 34;
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="trophy" size={17} /></span><h2>You vs You</h2></div>
        <span className="label-sm">Your best days</span>
      </div>
      <div className="card-body spread" style={{ display: "flex", flexDirection: "column", gap: compact ? 7 : 10 }}>
        {rows.length === 0 && (
          <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>
            No study days yet — your leaderboard fills in as you review.
          </div>
        )}
        {rows.map((r, i) => {
          const medal = MEDAL[i];
          const isLeader = i === 0;
          return (
            <div key={r.date.getTime()} style={{
              display: "flex", alignItems: "center", gap: compact ? 12 : 14,
              padding: compact ? "8px 12px" : "11px 14px", borderRadius: compact ? 12 : 14,
              background: isLeader ? "color-mix(in oklab, var(--accent) 14%, var(--card2))" : "var(--card2)",
              border: "1px solid " + (isLeader ? "color-mix(in oklab, var(--accent) 34%, transparent)" : "transparent"),
            }}>
              {/* medal / rank badge */}
              <div style={{
                width: badge, height: badge, borderRadius: "50%", flex: "0 0 auto", display: "grid", placeItems: "center",
                background: medal ? medal.fill : "var(--card)",
                border: medal ? "none" : "1px solid var(--border)",
                boxShadow: medal ? "0 1px 4px rgba(0,0,0,.28), inset 0 1px 1px rgba(255,255,255,.35)" : "none",
              }}>
                <span className="num" style={{ fontSize: compact ? 14 : 16, fontWeight: 800, color: medal ? medal.ink : "var(--text2)" }}>{i + 1}</span>
              </div>
              {/* date + time · recall */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: compact ? 14 : 15.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fmt.fmtDate(r.date)}</span>
                  {isLeader && <span style={{ color: "oklch(0.82 0.16 85)", display: "flex", flex: "0 0 auto" }}><Icon name="crown" size={compact ? 13 : 15} /></span>}
                </div>
                <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, marginTop: 2 }}>{fmt.fmtDurShort(r.timeSec)} · {Math.round(r.retention * 100)}% recall</div>
              </div>
              {/* card score */}
              <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                <div className="num" style={{ fontSize: compact ? 20 : 24, lineHeight: 1, color: isLeader ? "var(--accent)" : "var(--text)" }}>{r.total.toLocaleString()}</div>
                <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, marginTop: 1 }}>cards</div>
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
  const [barRef, barW] = useMeasure();   // measure the bar so it can render as SVG
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

        {/* Maturity progress — drawn as an SVG (not a %-width div) so the carousel's
            CSS zoom can't mis-size the fill in Anki's webview. A big "now" dot marks
            where you are; the 25/50/75/90% checkpoints are dots at their true
            positions, filled once passed. Always reads from the left. */}
        {(() => {
          const svgH = compact ? 22 : 26;
          const cy = svgH / 2;
          const thick = compact ? 8 : 10;     // bar thickness
          const mR = compact ? 6 : 7;         // milestone dot radius
          const nR = compact ? 8.5 : 10;      // "now" dot radius
          const W = Math.max(barW, 60);
          const curAt = Math.max(0, Math.min(100, pct));       // fill %
          const dotAt = Math.max(2, Math.min(98, curAt));      // keep the now dot on-track
          const xAt = (v) => (W * v) / 100;
          const ticks = marks.slice(1);        // 25 / 50 / 75 / 90
          return (
            <div style={{ margin: compact ? "16px 0 2px" : "22px 0 4px" }}>
              <div ref={barRef} style={{ width: "100%" }}>
                {barW > 0 && (
                  <svg width={W} height={svgH} style={{ display: "block", overflow: "visible" }}>
                    {/* track + fill */}
                    <rect x={0} y={cy - thick / 2} width={W} height={thick} rx={thick / 2} fill="var(--card2)" />
                    <rect x={0} y={cy - thick / 2} width={xAt(curAt)} height={thick} rx={thick / 2} fill="var(--accent)" />
                    {/* milestone dots — filled once reached */}
                    {ticks.map((m) => (
                      <circle key={m.label} cx={xAt(parseInt(m.label, 10))} cy={cy} r={mR}
                        fill={m.here ? "var(--accent)" : "var(--card)"}
                        stroke={m.here ? "var(--accent)" : "var(--text3)"} strokeWidth={2} />
                    ))}
                    {/* current-position "now" dot with a soft halo */}
                    <circle cx={xAt(dotAt)} cy={cy} r={nR + 3} fill="color-mix(in oklab, var(--accent) 30%, transparent)" />
                    <circle cx={xAt(dotAt)} cy={cy} r={nR} fill="var(--accent)" stroke="var(--card)" strokeWidth={3} />
                  </svg>
                )}
              </div>
              {/* labels: "now" under the current dot + the checkpoints */}
              <div style={{ position: "relative", height: compact ? 42 : 46, marginTop: 9 }}>
                <div style={{ position: "absolute", left: dotAt + "%", transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap" }}>
                  <div style={{ fontWeight: 800, fontSize: compact ? 12 : 13, color: "var(--accent)" }}>now</div>
                  <div className="num" style={{ fontSize: compact ? 11 : 12, color: "var(--accent)", marginTop: 2 }}>{pct}%</div>
                </div>
                {ticks.map((m) => {
                  const at = parseInt(m.label, 10);
                  return (
                    <div key={m.label} style={{ position: "absolute", left: at + "%", transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap" }}>
                      <div style={{ fontWeight: 800, fontSize: compact ? 12 : 13, color: m.here ? "var(--accent)" : "var(--text)" }}>{m.label}</div>
                      <div className="num" style={{ fontSize: compact ? 11 : 12, color: "var(--text2)", marginTop: 2 }}>{fmt.compact(m.count)}</div>
                      <div className="num" style={{ fontSize: compact ? 10.5 : 11.5, color: m.here ? "var(--accent)" : "var(--text3)", marginTop: 3 }}>{m.here ? "✓" : m.ms == null ? "—" : fmt.monYear(new Date(m.ms))}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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

// ========================= PENDING TODAY ===============================
// Today's progress as a simple "% done" bar: the green fill = the share of
// today's load already cleared (done / (done + remaining)). Below, one tile per
// kind (New / Learning / Due) keeps the pending counts legible. Defaults to all
// decks; the header dropdown focuses one. Display-only — switching never rescans.
const PENDING_KINDS = [
  { key: "new", label: "New", color: "oklch(0.70 0.14 250)" },
  { key: "learn", label: "Learning", color: "oklch(0.78 0.15 70)" },
  { key: "review", label: "Due", color: "oklch(0.74 0.16 150)" },
];
const PEND_DONE = "oklch(0.74 0.16 150)";

export function PendingCard({ anki, compact }) {
  const rows = anki.pending || [];
  const [deck, setDeck] = React.useState("");   // "" = all decks
  // Ignore a selection whose deck no longer has anything pending (studied away).
  const sel = deck && rows.some((r) => r.deck === deck) ? deck : "";
  const scope = sel ? rows.filter((r) => r.deck === sel) : rows;
  const counts = {
    new: scope.reduce((a, r) => a + (r.new || 0), 0),
    learn: scope.reduce((a, r) => a + (r.learn || 0), 0),
    review: scope.reduce((a, r) => a + (r.review || 0), 0),
  };
  const remaining = counts.new + counts.learn + counts.review;

  // "Done today" for the same scope, from today's study record — this is what
  // makes the bar burn down as the day goes on.
  const today = anki.days && anki.days.length ? anki.days[anki.days.length - 1] : null;
  const done = sel ? ((today && today.deckSplit && today.deckSplit[sel]) || 0) : (today ? today.total : 0);
  const peak = done + remaining;                       // this morning's full load
  const pct = peak > 0 ? Math.round((done / peak) * 100) : 0;
  const allClear = remaining === 0;

  const header = (
    <div className="card-h">
      <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="cards" size={17} /></span><h2>Pending Today</h2></div>
      {rows.length > 1 ? (
        <select className="field" value={sel} aria-label="Deck to show"
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => setDeck(e.target.value)}
          style={{ maxWidth: 170, fontSize: compact ? 11.5 : 12.5, padding: "4px 8px" }}>
          <option value="">All decks</option>
          {rows.map((r) => <option key={r.deck} value={r.deck}>{r.deck}</option>)}
        </select>
      ) : rows.length === 1 ? (
        <span className="label-sm" style={{ maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rows[0].deck}</span>
      ) : null}
    </div>
  );

  const caption = allClear
    ? (done > 0 ? "cleared — nice work 🎉" : "nothing due today")
    : ((remaining === 1 ? "card" : "cards") + " left today" + (sel ? " · " + sel : ""));

  return (
    <div className="card">
      {header}
      <div className="card-body spread">
        {/* hero: remaining count + how much of today is already cleared */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
            <div className="num" style={{ fontSize: compact ? 44 : 54, lineHeight: 1, color: allClear ? PEND_DONE : "var(--accent)" }}>{remaining.toLocaleString()}</div>
            <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, color: "var(--text2)", fontSize: compact ? 12.5 : 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{caption}</div>
          </div>
          {peak > 0 && (
            <div style={{ textAlign: "right", flex: "0 0 auto" }}>
              <div className="num" style={{ fontSize: compact ? 16 : 19, color: PEND_DONE, lineHeight: 1 }}>{pct}<span style={{ fontSize: "0.6em" }}>%</span></div>
              <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, marginTop: 2 }}>{done.toLocaleString()} done</div>
            </div>
          )}
        </div>

        {/* the simple graphic — a plain "% done" progress bar for today */}
        <div>
          <div style={{ height: compact ? 26 : 32, borderRadius: 999, overflow: "hidden", background: "var(--card2)" }}>
            <div style={{ width: (allClear ? 100 : pct) + "%", height: "100%", borderRadius: 999, background: "linear-gradient(90deg, oklch(0.64 0.15 152), oklch(0.76 0.16 148))", transition: "width .6s cubic-bezier(.2,.8,.2,1)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>{pct}% done · {done.toLocaleString()} cards</span>
            <span className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>{allClear ? "all clear 🎉" : remaining.toLocaleString() + " to go"}</span>
          </div>
        </div>

        {/* New / Learning / Due breakdown tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: compact ? 8 : 12 }}>
          {PENDING_KINDS.map((p) => (
            <div key={p.key} style={{ background: "var(--card2)", borderRadius: "var(--r-sm)", padding: compact ? "10px 11px" : "13px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: compact ? 5 : 7 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color, flex: "0 0 auto" }} />
                <span className="label" style={{ fontWeight: 700, color: "var(--text2)" }}>{p.label}</span>
              </div>
              <div className="num" style={{ fontSize: compact ? 22 : 28, lineHeight: 1 }}>{counts[p.key].toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
