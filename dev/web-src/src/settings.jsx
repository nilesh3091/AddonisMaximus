/* Settings drawer — opened by the gear icon. Edits the live config object;
   every change is persisted by App (which also pushes appearance to <html> and
   asks Python to recompute when the data scope changes). */
import React from "react";
import { Icon } from "./icons.jsx";
import { SECTIONS, GOAL_SOURCES, deckScope } from "./config.js";

// Non-null when the drawer is opened from a deck's overview screen: the
// dataset behind it is scoped to that deck, which the deck filter cannot
// change, so say so rather than leaving a control that looks inert.
const SCOPE_DECK = deckScope();
import { ankiLogoUrl } from "./anki_b64.js";

const THEMES = [
  { value: "strava", label: "Strava (orange)" },
  { value: "midnight", label: "Midnight (blue)" },
  { value: "aurora", label: "Aurora (teal)" },
  { value: "violet", label: "Violet (purple)" },
  { value: "daylight", label: "Daylight (light)" },
];

// Multiplies the carousel zoom — scales text, rings, charts and spacing together.
const TEXT_SIZES = [
  { value: 0.85, label: "Small" },
  { value: 1, label: "Default" },
  { value: 1.2, label: "Large" },
  { value: 1.4, label: "Extra large" },
];

// How tall each carousel card is, in pre-zoom px (the zoom from Text size still
// applies on top). Cards that need more room — the Dashboard — raise this on
// their own, so "Standard" never truncates them.
const CARD_HEIGHTS = [
  { value: 320, label: "Standard" },
  { value: 420, label: "Tall" },
  { value: 520, label: "Taller" },
];

const ICON_FOR_SOURCE = { total: "layers", reviews: "repeat", newC: "plus", time: "clock", daysStudied: "check" };

function Seg({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? "active" : ""} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

function Switch({ on, onChange, label }) {
  return (
    <button className="switch" data-on={on ? "1" : "0"} role="switch" aria-checked={on}
      aria-label={label} onClick={() => onChange(!on)}><i /></button>
  );
}

// Collapsible settings section. Collapsed by default so the drawer opens as a
// short, scannable list of headers; the user expands only what they need.
function Section({ title, defaultOpen = false, children }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={"set-sect" + (open ? " open" : "")}>
      <button className="set-sect-h" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="set-sect-title">{title}</span>
        <span className="set-sect-caret"><Icon name="chevronDown" size={16} /></span>
      </button>
      {open && <div className="set-sect-body">{children}</div>}
    </div>
  );
}

export function SettingsDrawer({ config, setConfig, anki, onClose }) {
  // Esc closes the drawer.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setAppearance = (k, v) => setConfig({ ...config, appearance: { ...config.appearance, [k]: v } });
  const setData = (k, v) => setConfig({ ...config, data: { ...config.data, [k]: v } });
  const setGoals = (goals) => setConfig({ ...config, goals });
  const setSections = (sections) => setConfig({ ...config, sections });

  // ---- sections (show/hide + reorder) ----------------------------------
  const order = config.sections.order;
  const hidden = new Set(config.sections.hidden);
  const meta = Object.fromEntries(SECTIONS.map((s) => [s.key, s]));
  const toggleHidden = (key) => {
    const next = new Set(hidden);
    next.has(key) ? next.delete(key) : next.add(key);
    setSections({ ...config.sections, hidden: [...next] });
  };
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setSections({ ...config.sections, order: next });
  };

  // ---- goals -----------------------------------------------------------
  const updateGoal = (i, patch) => {
    const next = config.goals.slice();
    next[i] = { ...next[i], ...patch };
    setGoals(next);
  };
  const changeSource = (i, source) => {
    const meta = GOAL_SOURCES.find((s) => s.value === source) || GOAL_SOURCES[0];
    updateGoal(i, { source, unit: meta.unit, icon: ICON_FOR_SOURCE[source] || "target" });
  };
  const addGoal = () => {
    const key = "goal_" + Date.now().toString(36);
    setGoals([...config.goals, { key, label: "New goal", icon: "layers", source: "total", unit: "count", targetMode: "average", weeklyTarget: 100 }]);
  };
  const removeGoal = (i) => setGoals(config.goals.filter((_, k) => k !== i));

  const visibleCount = order.length - hidden.size;
  const visibleOrder = order.filter((k) => !hidden.has(k));
  // The carousel's "opens on" card; fall back to the first visible card if the
  // chosen one was hidden or is unknown.
  const defaultCardVal = visibleOrder.includes(config.sections.defaultCard) ? config.sections.defaultCard : visibleOrder[0];
  // Use the UNFILTERED deck list for the picker. Sourcing it from anki.decks
  // (which is filtered by includeDecks) would hide a deck once excluded, leaving
  // no way to re-enable it. Names already in includeDecks but absent from the
  // collection list are still shown so a stale selection can be cleared.
  const deckNames = [...new Set([...(anki.allDecks || (anki.decks || []).map((d) => d.name)), ...(config.data.includeDecks || [])])];
  const includeDecks = new Set(config.data.includeDecks || []);
  const toggleDeck = (name) => {
    // An empty set is the "all decks" sentinel and renders every switch as on.
    // Materialise the full list before toggling so turning one switch off
    // removes just that deck instead of flipping the meaning to "only this one".
    const next = includeDecks.size === 0 ? new Set(deckNames) : new Set(includeDecks);
    next.has(name) ? next.delete(name) : next.add(name);
    // Collapse back to the "all" sentinel when everything is selected again
    // (also when the last deck is switched off — never filter down to nothing).
    setData("includeDecks", next.size === 0 || next.size === deckNames.length ? [] : [...next]);
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label="Addonis Maximus settings">
        <div className="drawer-h">
          <h2><span className="gi"><Icon name="gear" size={19} /></span>Settings</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close settings"><Icon name="x" size={18} /></button>
        </div>
        <div className="drawer-body">

          {/* ---------------- Appearance ---------------- */}
          <Section title="Appearance">
            <div className="set-row">
              <div>
                <div className="set-label">View mode</div>
                <div className="set-desc">Multi stacks the goal rings, graph and heat-map together</div>
              </div>
              <Seg value={config.appearance.viewMode === "multi" ? "multi" : "single"}
                options={[{ value: "single", label: "Single card" }, { value: "multi", label: "Multi" }]}
                onChange={(v) => setAppearance("viewMode", v)} />
            </div>
            <div className="set-row">
              <div><div className="set-label">Theme</div></div>
              <select className="field" value={config.appearance.theme} onChange={(e) => setAppearance("theme", e.target.value)}>
                {THEMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="set-row">
              <div>
                <div className="set-label">Text size</div>
                <div className="set-desc">Scales the whole panel up or down</div>
              </div>
              <select className="field" value={String(config.appearance.textScale ?? 1)} onChange={(e) => setAppearance("textScale", Number(e.target.value))}>
                {TEXT_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="set-row">
              <div>
                <div className="set-label">Card height</div>
                <div className="set-desc">Single-card mode only — more room per card</div>
              </div>
              <select className="field" value={String(config.appearance.stageHeight ?? 320)} onChange={(e) => setAppearance("stageHeight", Number(e.target.value))}>
                {CARD_HEIGHTS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
            <div className="set-row">
              <div><div className="set-label">Trend chart</div></div>
              <Seg value={config.appearance.chart} options={[{ value: "area", label: "Area" }, { value: "bar", label: "Bars" }]} onChange={(v) => setAppearance("chart", v)} />
            </div>
            <div className="set-row">
              <div><div className="set-label">Corners</div></div>
              <Seg value={config.appearance.corners} options={[{ value: "round", label: "Round" }, { value: "sharp", label: "Sharp" }]} onChange={(v) => setAppearance("corners", v)} />
            </div>
          </Section>

          {/* ---------------- Sections ---------------- */}
          <Section title={`Cards & sections · ${visibleCount} shown`}>
            <div className="set-desc" style={{ marginBottom: 8 }}>Toggle which cards appear, and reorder them. Hidden cards are removed from the panel.</div>
            {visibleOrder.length > 1 && (
              <div className="set-row" style={{ marginBottom: 4 }}>
                <div>
                  <div className="set-label">Default card</div>
                  <div className="set-desc">Which card the carousel opens on</div>
                </div>
                <select className="field" value={defaultCardVal}
                  onChange={(e) => setSections({ ...config.sections, defaultCard: e.target.value })}>
                  {visibleOrder.map((k) => <option key={k} value={k}>{meta[k] ? meta[k].label : k}</option>)}
                </select>
              </div>
            )}
            {order.map((key, idx) => {
              const m = meta[key];
              if (!m) return null;
              const isHidden = hidden.has(key);
              return (
                <div key={key} className={"sec-item" + (isHidden ? " hidden" : "")}>
                  <span className="grab"><Icon name={isHidden ? "eyeOff" : "eye"} size={16} /></span>
                  <span className="sec-name">{m.label}</span>
                  <span className="updown">
                    <button className="iconbtn" disabled={idx === 0} style={{ opacity: idx === 0 ? 0.3 : 1 }} onClick={() => move(idx, -1)} aria-label="move up"><Icon name="chevronUp" size={15} /></button>
                    <button className="iconbtn" disabled={idx === order.length - 1} style={{ opacity: idx === order.length - 1 ? 0.3 : 1 }} onClick={() => move(idx, 1)} aria-label="move down"><Icon name="chevronDown" size={15} /></button>
                  </span>
                  <Switch on={!isHidden} onChange={() => toggleHidden(key)} label={"Show " + m.label} />
                </div>
              );
            })}
          </Section>

          {/* ---------------- Goals ---------------- */}
          <Section title="Goals">
            <div className="set-desc" style={{ marginBottom: 10 }}>Pick <b>Average</b> to target your recent pace, or <b>Custom</b> for a set number. Targets scale across week, month and year automatically.</div>
            {config.goals.map((g, i) => (
              <GoalEditor key={g.key} g={g} anki={anki} onLabel={(v) => updateGoal(i, { label: v })}
                onSource={(v) => changeSource(i, v)} onTarget={(v) => updateGoal(i, { weeklyTarget: v })}
                onMode={(v) => updateGoal(i, { targetMode: v })}
                onDelete={() => removeGoal(i)} />
            ))}
            <button className="btn-add" onClick={addGoal}><Icon name="plus" size={16} /> Add a goal</button>
          </Section>

          {/* ---------------- Data & collection ---------------- */}
          <Section title="Data & collection">
            <div className="set-row">
              <div className="set-label-wrap">
                <div>
                  <div className="set-label">Day rollover</div>
                  <div className="set-desc">When a new study day begins</div>
                </div>
              </div>
              <select className="field" value={config.data.cutoffHour == null ? "auto" : String(config.data.cutoffHour)}
                onChange={(e) => setData("cutoffHour", e.target.value === "auto" ? null : Number(e.target.value))}>
                <option value="auto">Auto (Anki)</option>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h === 0 ? "12 AM" : h < 12 ? h + " AM" : h === 12 ? "12 PM" : (h - 12) + " PM"}</option>)}
              </select>
            </div>
            <div className="set-row">
              <div>
                <div className="set-label">Mature threshold</div>
                <div className="set-desc">Interval (days) a card counts as “mature”</div>
              </div>
              <div className="time-target">
                <input className="field num-field" type="number" min={1} max={365} value={config.data.matureThresholdDays}
                  onChange={(e) => setData("matureThresholdDays", Math.max(1, Number(e.target.value) || 1))} />
                <span className="tt-unit">days</span>
              </div>
            </div>
            <div className="set-row">
              <div>
                <div className="set-label">Streak minimum</div>
                <div className="set-desc">Cards needed for a day to keep the streak</div>
              </div>
              <div className="time-target">
                <input className="field num-field" type="number" min={1} max={9999} value={config.data.streakMinCards}
                  onChange={(e) => setData("streakMinCards", Math.max(1, Number(e.target.value) || 1))} />
                <span className="tt-unit">cards</span>
              </div>
            </div>
            {SCOPE_DECK && (
              <div className="set-note" style={{ marginTop: 10 }}>
                This panel is on <b>{SCOPE_DECK}</b>’s own screen, so it always shows that
                deck and its subdecks — the deck filter below applies to the Decks screen.
              </div>
            )}
            {deckNames.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div className="set-label" style={{ marginBottom: 4 }}>Include decks</div>
                <div className="set-desc" style={{ marginBottom: 8 }}>{includeDecks.size === 0 ? "All decks included." : includeDecks.size + " selected."}</div>
                {deckNames.map((name) => (
                  <div key={name} className="set-row" style={{ padding: "7px 0" }}>
                    <span className="set-label" style={{ fontWeight: 600 }}>{name}</span>
                    <Switch on={includeDecks.size === 0 || includeDecks.has(name)} onChange={() => toggleDeck(name)} label={name} />
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ---------------- Share ---------------- */}
          <Section title="Share">
            <ShareSection anki={anki} />
          </Section>

        </div>
      </div>
    </>
  );
}

function GoalEditor({ g, anki, onLabel, onSource, onTarget, onMode, onDelete }) {
  const isTime = g.unit === "time";
  const mode = g.targetMode || "average";
  // Time targets are stored in seconds; edit in hours.
  const shown = isTime ? Math.round((g.weeklyTarget / 3600) * 10) / 10 : g.weeklyTarget;
  const onShown = (v) => onTarget(isTime ? Math.round(v * 3600) : Math.round(v));
  // Live preview of the user's recent weekly average for this source.
  const avg = anki && anki.avgWeekly ? anki.avgWeekly(g.source) : 0;
  const avgShown = isTime ? anki.fmt.fmtDurShort(Math.round(avg)) : Math.round(avg).toLocaleString();
  return (
    <div className="goal-edit">
      <div className="goal-edit-top">
        <span className="gei"><Icon name={g.icon} size={18} sw={1.8} /></span>
        <input className="field" type="text" value={g.label} placeholder="Goal name" onChange={(e) => onLabel(e.target.value)} />
        <button className="goal-del" onClick={onDelete} aria-label="Delete goal"><Icon name="trash" size={16} /></button>
      </div>
      <div className="goal-edit-grid">
        <span className="gl">Tracks</span>
        <select className="field" value={g.source} onChange={(e) => onSource(e.target.value)} style={{ minWidth: 150 }}>
          {GOAL_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <span className="gl">Target</span>
        <Seg value={mode} options={[{ value: "average", label: "Average" }, { value: "fixed", label: "Custom" }]} onChange={onMode} />
        {mode === "fixed" ? (
          <>
            <span className="gl">Weekly target</span>
            <div className="time-target">
              <input className="field num-field" type="number" min={isTime ? 0.5 : 1} step={isTime ? 0.5 : 1} value={shown}
                onChange={(e) => onShown(Math.max(0, Number(e.target.value) || 0))} />
              <span className="tt-unit">{isTime ? "h / wk" : "/ wk"}</span>
            </div>
          </>
        ) : (
          <>
            <span className="gl">Your average</span>
            <div className="time-target" title="Your recent weekly pace — updates as you study">
              <span className="num" style={{ fontSize: 14 }}>{avgShown}</span>
              <span className="tt-unit">/ wk</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ShareSection({ anki }) {
  const [period, setPeriod] = React.useState("day");
  const [offset, setOffset] = React.useState(0);
  const [selectedStats, setSelectedStats] = React.useState({
    cards: true, retention: true, time: true, 
    newCards: true, streak: true, speed: true
  });
  const canvasRef = React.useRef(null);

  const handlePeriodChange = (p) => {
    setPeriod(p);
    setOffset(0);
  };

  // Compute period boundaries and label
  let list = [];
  let periodLabel = "";
  if (anki) {
    if (period === "day") {
      const dDate = new Date(anki.TODAY.getTime() + offset * 86400000);
      list = anki.days.filter((d) => d.date.getTime() === dDate.getTime());
      periodLabel = anki.fmt.fmtDate(dDate);
      if (offset === 0) periodLabel = "Today";
      else if (offset === -1) periodLabel = "Yesterday";
    } else if (period === "week") {
      const ws = new Date(anki.startOfWeek(anki.TODAY).getTime() + offset * 7 * 86400000);
      const we = new Date(ws.getTime() + 7 * 86400000);
      list = anki.days.filter((d) => d.date >= ws && d.date < we);
      periodLabel = "Week of " + anki.fmt.fmtDate(ws);
      if (offset === 0) periodLabel = "This Week";
      else if (offset === -1) periodLabel = "Last Week";
    } else { // month
      const ref = new Date(Date.UTC(anki.TODAY.getUTCFullYear(), anki.TODAY.getUTCMonth() + offset, 1));
      const next = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
      list = anki.days.filter((d) => d.date >= ref && d.date < next);
      periodLabel = anki.fmt.monthYearFull(ref);
      if (offset === 0) periodLabel = "This Month";
      else if (offset === -1) periodLabel = "Last Month";
    }
  }

  React.useEffect(() => {
    if (!canvasRef.current || !anki) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    // Size: 1080x1920
    const w = 1080;
    const h = 1920;
    canvas.width = w;
    canvas.height = h;

    // Solid dark background to prevent text from disappearing against white backgrounds (e.g. Photos app)
    ctx.fillStyle = "#1c1c1e";
    ctx.fillRect(0, 0, w, h);

    // Get stats from filtered list
    const total = list.reduce((a, d) => a + (d.total || 0), 0);
    const timeSec = list.reduce((a, d) => a + (d.timeSec || 0), 0);
    const newC = list.reduce((a, d) => a + (d.newC || 0), 0);
    // Graded total as the denominator, not `reviews` — see avgRetention in data.js.
    let graded = 0, again = 0;
    list.forEach(d => { graded += (d.again || 0) + (d.hard || 0) + (d.good || 0) + (d.easy || 0); again += d.again || 0; });
    const retention = graded > 0 ? (graded - again) / graded : 0;
    const speed = total > 0 ? timeSec / total : 0;
    // Streak is kept as current overall streak unless we want to compute it backwards,
    // which is complex. Using the global current streak is fine.
    const streak = anki.streakDays || 0;

    // Format stats based on selection
    const statsToDraw = [];
    if (selectedStats.cards) statsToDraw.push({ label: "Cards", value: total.toLocaleString() });
    if (selectedStats.retention) statsToDraw.push({ label: "Retention", value: (retention * 100).toFixed(1) + "%" });
    if (selectedStats.time) statsToDraw.push({ label: "Time", value: anki.fmt.fmtDurShort(timeSec) });
    if (selectedStats.newCards) statsToDraw.push({ label: "New Cards", value: newC.toLocaleString() });
    if (selectedStats.streak) statsToDraw.push({ label: "Streak", value: streak + " days" });
    if (selectedStats.speed) statsToDraw.push({ label: "Speed", value: speed > 0 ? speed.toFixed(1) + "s/c" : "0s/c" });

    // Fonts and Colors
    ctx.fillStyle = "#ffffff";
    const boldFont = "800 64px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    const labelFont = "800 42px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    
    // Draw Logo (Anki logo from Downloads)
    const img = new Image();
    img.src = ankiLogoUrl;
    img.onload = () => {
      // Draw centered in the top half
      ctx.drawImage(img, w / 2 - 128, h / 2 - 350, 256, 256);
    };

    // Draw Period Label
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "600 42px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(periodLabel, w / 2, h / 2 - 20);

    // Draw Stats Grid (up to 2 rows, 3 columns depending on how many selected)
    const cols = [120, 450, 780];
    const rows = [h / 2 + 100, h / 2 + 280, h / 2 + 460]; // shifted down slightly for label
    
    for (let i = 0; i < statsToDraw.length; i++) {
      const col = cols[i % 3];
      const row = rows[Math.floor(i / 3)];
      
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = labelFont;
      ctx.fillText(statsToDraw[i].label, col, row);
      
      ctx.fillStyle = "#ffffff";
      ctx.font = boldFont;
      ctx.fillText(statsToDraw[i].value, col, row + 70);
    }

  }, [period, offset, selectedStats, anki, list, periodLabel]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const dataUri = canvasRef.current.toDataURL("image/png");
    if (window.pycmd) {
      window.pycmd("addonismaximus:save_image:" + dataUri);
    } else {
      // Fallback for browser testing
      const a = document.createElement("a");
      a.href = dataUri;
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = "ankstats_share_" + ts + ".png";
      a.click();
    }
  };

  const toggleStat = (key) => setSelectedStats(s => ({ ...s, [key]: !s[key] }));

  return (
    <div className="share-section" style={{ paddingBottom: 10 }}>
      <div className="set-desc" style={{ marginBottom: 16 }}>
        Export a transparent sticker of your stats to share on Instagram or Snapchat.
      </div>
      <div className="set-row" style={{ marginBottom: 16 }}>
        <div><div className="set-label">Range Type</div></div>
        <Seg value={period} options={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" }
        ]} onChange={handlePeriodChange} />
      </div>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, padding: "8px 12px", background: "rgba(0,0,0,0.05)", borderRadius: 8 }}>
        <button className="iconbtn" onClick={() => setOffset(o => o - 1)} aria-label="Previous"><Icon name="chevronL" size={20} /></button>
        <span style={{ fontWeight: 600 }}>{periodLabel}</span>
        <button className="iconbtn" onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset >= 0} style={{ opacity: offset >= 0 ? 0.3 : 1 }} aria-label="Next"><Icon name="chevronR" size={20} /></button>
      </div>
      
      <div className="set-label" style={{ marginBottom: 8 }}>Included Stats</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginBottom: 24 }}>
        {[
          { key: "cards", label: "Cards" },
          { key: "retention", label: "Retention" },
          { key: "time", label: "Time" },
          { key: "newCards", label: "New Cards" },
          { key: "streak", label: "Streak" },
          { key: "speed", label: "Speed" },
        ].map(s => (
          <div key={s.key} className="set-row" style={{ padding: "4px 0" }}>
            <span className="set-name">{s.label}</span>
            <Switch on={selectedStats[s.key]} onChange={() => toggleStat(s.key)} label={"Include " + s.label} />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ 
          width: "100%", 
          maxWidth: 240, 
          aspectRatio: "1080/1920",
          background: "linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee), linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 10px 10px",
          backgroundColor: "#ccc",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid rgba(0,0,0,0.1)"
        }}>
          <canvas 
            ref={canvasRef} 
            style={{ width: "100%", height: "100%", display: "block" }} 
          />
        </div>
        <button className="btn-add" onClick={handleDownload} style={{ width: "100%", justifyContent: "center" }}>
          <Icon name="download" size={16} /> Download Image
        </button>
      </div>
    </div>
  );
}
