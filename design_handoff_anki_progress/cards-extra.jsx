/* Extra cards. -> window */
const A = window.ANKI;
const efmt = A.fmt;

const DECK_COLORS = [
"var(--accent)",
"oklch(0.72 0.13 205)",
"oklch(0.72 0.14 305)",
"oklch(0.76 0.15 135)",
"oklch(0.78 0.13 65)"];


function Legend({ items }) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
      {items.map((it, i) =>
      <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text2)", fontWeight: 600 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: it.c }} />{it.label}
          {it.v != null && <span style={{ color: "var(--text)", fontFamily: "var(--font-num)", fontWeight: 700 }}>{it.v}</span>}
        </div>
      )}
    </div>);

}

// ============================ FORECAST =================================
function ForecastCard() {
  const data = A.forecast.map((f) => ({
    x: f.day === 0 ? "Today" : "+" + f.day,
    tip: f.day === 0 ? "Due today" : "In " + f.day + " days",
    young: f.young, mature: f.mature
  }));
  const dueTomorrow = A.forecast[1].total;
  const weekTotal = A.forecast.slice(0, 7).reduce((a, f) => a + f.total, 0);
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="calendar" size={17} /></span><h2>Forecast</h2></div>
        <span className="label-sm">Next 30 days</span>
      </div>
      <div style={{ display: "flex", gap: 28, marginBottom: 6 }}>
        <div><div className="label-sm">Due tomorrow</div><div className="num" style={{ fontSize: 22 }}>{dueTomorrow}</div></div>
        <div><div className="label-sm">Next 7 days</div><div className="num" style={{ fontSize: 22 }}>{weekTotal.toLocaleString()}</div></div>
      </div>
      <Bars data={data} height={158} segments={["mature", "young"]}
      colors={["var(--accent)", "color-mix(in oklab, var(--accent) 55%, var(--card2))"]}
      valueFmt={(v) => efmt.compact(Math.round(v))} labelEvery={5} />
      <Legend items={[{ c: "var(--accent)", label: "Mature" }, { c: "color-mix(in oklab, var(--accent) 55%, var(--card2))", label: "Young" }]} />
    </div>);

}

// ========================= ANSWER BUTTONS ==============================
function AnswerButtonsCard({ range }) {
  const p = A.period(range, "reviews");
  const sum = (k) => p.list.reduce((a, d) => a + d[k], 0);
  const again = sum("again"),hard = sum("hard"),good = sum("good"),easy = sum("easy");
  const total = again + hard + good + easy || 1;
  const segs = [
  { k: "Again", v: again, c: "var(--again)" },
  { k: "Hard", v: hard, c: "var(--hard)" },
  { k: "Good", v: good, c: "var(--good)" },
  { k: "Easy", v: easy, c: "var(--easy)" }];

  const retention = Math.round((total - again) / total * 100);
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="gauge" size={17} /></span><h2>Answer Buttons</h2></div>
        <span className="label-sm">True retention {retention}%</span>
      </div>
      <div style={{ display: "flex", height: 26, borderRadius: 7, overflow: "hidden", gap: 2 }}>
        {segs.map((s) =>
        <div key={s.k} title={s.k + " " + s.v} style={{ width: s.v / total * 100 + "%", background: s.c, minWidth: s.v ? 2 : 0, transition: "width .5s" }} />
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 16 }}>
        {segs.map((s) =>
        <div key={s.k}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: s.c }} />
              <span className="label" style={{ fontWeight: 700, color: "var(--text)" }}>{s.k}</span>
            </div>
            <div className="num" style={{ fontSize: 19, marginTop: 4 }}>{Math.round(s.v / total * 100)}<span style={{ fontSize: 12, color: "var(--text2)" }}>%</span></div>
            <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>{s.v.toLocaleString()}</div>
          </div>
        )}
      </div>
    </div>);

}

// ============================= HOURLY ==================================
function HourlyCard() {
  const [ref, w] = useMeasure();
  const hours = A.hourly;
  const peak = hours.reduce((a, h) => h.pct > a.pct ? h : a, hours[0]);
  const max = Math.max(...hours.map((h) => h.pct));
  const H = 150,padB = 22,padT = 10;
  const innerH = H - padB - padT;
  const W = Math.max(w, 60);
  const bw = W / 24 * 0.66;
  const fmtH = (h) => h === 0 ? "12a" : h < 12 ? h + "a" : h === 12 ? "12p" : h - 12 + "p";
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="clock" size={17} /></span><h2>When You Study Best</h2></div>
        <span className="label-sm">Peak {fmtH(peak.hour)}</span>
      </div>
      <div ref={ref} style={{ width: "100%" }}>
        {w > 0 &&
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
                </g>);

          })}
          </svg>
        }
      </div>
      <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, marginTop: 8 }}>
        You log most reviews around <b style={{ color: "var(--text)" }}>{fmtH(peak.hour)}</b> — and your retention is highest in the morning.
      </div>
    </div>);

}

// ============================== FSRS ===================================
// recall heat scale: <70% red → 70–80% orange → 80–90% yellow → 90–95% green → >95% dark green
const FSRS_BAR_COLORS = [
"oklch(0.62 0.21 25)",
"oklch(0.72 0.17 55)",
"oklch(0.83 0.16 95)",
"oklch(0.74 0.16 150)",
"oklch(0.5 0.11 150)"];

function FsrsCard() {
  const f = A.fsrs;
  const maxR = Math.max(...f.retr.map((r) => r.n));
  const tiles = [
  { label: "Avg stability", value: f.stability, unit: "days", icon: "shield" },
  { label: "Avg difficulty", value: Math.round(f.difficulty * 100) + "%", unit: "lower=easier", icon: "gauge" },
  { label: "Retrievability", value: Math.round(f.retrievability * 100) + "%", unit: "predicted recall", icon: "brain" }];

  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="brain" size={17} /></span><h2>Memory Strength <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700 }}>FSRS</span></h2></div>
        <span className="label-sm">{f.mature.toLocaleString()} mature</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
        {tiles.map((t) =>
        <div key={t.label} style={{ background: "var(--card2)", borderRadius: "var(--r-sm)", padding: "12px 13px" }}>
            <div style={{ color: "var(--accent)", marginBottom: 7 }}><Icon name={t.icon} size={17} /></div>
            <div className="num" style={{ fontSize: 22 }}>{t.value}</div>
            <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, marginTop: 2 }}>{t.label}</div>
          </div>
        )}
      </div>
      <div className="label-sm" style={{ marginBottom: 10 }}>Cards by predicted recall</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {f.retr.map((r, i) =>
        <div key={r.band} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 56, fontSize: 12, color: "var(--text2)", fontWeight: 600, textAlign: "right" }}>{r.band}</span>
            <div style={{ flex: 1, height: 14, background: "var(--card2)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: r.n / maxR * 100 + "%", height: "100%", background: FSRS_BAR_COLORS[i % FSRS_BAR_COLORS.length], borderRadius: 4, transition: "width .6s" }} />
            </div>
            <span className="num" style={{ width: 48, fontSize: 13, textAlign: "right" }}>{efmt.compact(r.n)}</span>
          </div>
        )}
      </div>
    </div>);

}

// ========================= DECK LEADERBOARD ============================
function DeckBoardCard({ range }) {
  const rows = A.deckBoard(range);
  const max = Math.max(...rows.map((r) => r.cards), 1);
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="trophy" size={17} /></span><h2>Deck Leaderboard</h2></div>
        <span className="label-sm">{range === "week" ? "This week" : range === "month" ? "This month" : "This year"}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.map((r, i) =>
        <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <span className="num" style={{ width: 18, color: "var(--text3)", fontSize: 14 }}>{i + 1}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 10 }}>{r.name}</span>
                <span className="num" style={{ fontSize: 14 }}>{r.cards.toLocaleString()} <span style={{ color: "var(--text3)", fontWeight: 600, fontSize: 12 }}>cards</span></span>
              </div>
              <div style={{ height: 8, background: "var(--card2)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: r.cards / max * 100 + "%", height: "100%", background: DECK_COLORS[i % DECK_COLORS.length], borderRadius: 4, transition: "width .6s" }} />
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: 64 }}>
              <div className="num" style={{ fontSize: 13 }}>{efmt.fmtDurShort(r.time)}</div>
              <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0 }}>{Math.round(r.retain * 100)}% ret</div>
            </div>
          </div>
        )}
      </div>
    </div>);

}

// =========================== RECORDS ===================================
const RECORD_ICONS = ["bolt", "flame", "clock", "layers", "trophy", "target"];
function RecordsCard() {
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="trophy" size={17} /></span><h2>Personal Records</h2></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {A.records.map((r, i) =>
        <div key={r.label} style={{ background: "var(--card2)", borderRadius: "var(--r-sm)", padding: "13px 14px" }}>
            <div style={{ color: "var(--accent)", marginBottom: 8 }}><Icon name={RECORD_ICONS[i % RECORD_ICONS.length]} size={17} /></div>
            <div className="num" style={{ fontSize: 21, lineHeight: 1 }}>{r.value}{r.unit ? <span style={{ fontSize: 12, color: "var(--text2)", marginLeft: 4 }}>{r.unit}</span> : null}</div>
            <div className="label" style={{ fontWeight: 700, color: "var(--text)", marginTop: 5 }}>{r.label}</div>
            <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, marginTop: 1 }}>{r.sub}</div>
          </div>
        )}
      </div>
    </div>);

}

// ========================= ACHIEVEMENTS ================================
function AchievementsCard() {
  const got = A.achievements.filter((a) => a.got).length;
  return (
    <div className="card">
      <div className="card-h">
        <div className="icon-title"><span style={{ color: "var(--accent)" }}><Icon name="star" size={17} /></span><h2>Achievements</h2></div>
        <span className="label-sm">{got} / {A.achievements.length} unlocked</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(108px,1fr))", gap: 12 }}>
        {A.achievements.map((a) =>
        <div key={a.name} style={{ textAlign: "center", opacity: a.got ? 1 : 0.92 }}>
            <div style={{ position: "relative", width: 64, height: 64, margin: "0 auto 8px" }}>
              {a.got ?
            <div style={{ width: 64, height: 64, borderRadius: "50%", display: "grid", placeItems: "center",
              background: "color-mix(in oklab, var(--accent) 20%, var(--card2))", border: "2px solid var(--accent)", color: "#fff" }}>
                  <Icon name={a.icon} size={26} sw={1.8} />
                </div> :

            <Ring value={a.progress || 0} max={1} size={64} stroke={5} color="var(--text3)">
                  <span style={{ color: "#fff" }}><Icon name="lock" size={20} /></span>
                </Ring>
            }
            </div>
            <div style={{ fontWeight: 700, fontSize: 12.5, color: a.got ? "var(--text)" : "var(--text2)" }}>{a.name}</div>
            <div className="label-sm" style={{ textTransform: "none", letterSpacing: 0, lineHeight: 1.25, marginTop: 2 }}>
              {a.got ? a.desc : Math.round((a.progress || 0) * 100) + "% · " + a.desc}
            </div>
          </div>
        )}
      </div>
    </div>);

}

Object.assign(window, { ForecastCard, AnswerButtonsCard, HourlyCard, FsrsCard, DeckBoardCard, RecordsCard, AchievementsCard });