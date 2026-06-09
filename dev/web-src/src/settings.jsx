/* Settings drawer — opened by the gear icon. Edits the live config object;
   every change is persisted by App (which also pushes appearance to <html> and
   asks Python to recompute when the data scope changes). */
import React from "react";
import { Icon } from "./icons.jsx";
import { SECTIONS, GOAL_SOURCES } from "./config.js";

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
  const decks = anki.decks || [];
  const includeDecks = new Set(config.data.includeDecks || []);
  const toggleDeck = (name) => {
    const next = new Set(includeDecks);
    next.has(name) ? next.delete(name) : next.add(name);
    setData("includeDecks", [...next]);
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label="Recall settings">
        <div className="drawer-h">
          <h2><span className="gi"><Icon name="gear" size={19} /></span>Settings</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close settings"><Icon name="x" size={18} /></button>
        </div>
        <div className="drawer-body">

          {/* ---------------- Appearance ---------------- */}
          <Section title="Appearance">
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
            {decks.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div className="set-label" style={{ marginBottom: 4 }}>Include decks</div>
                <div className="set-desc" style={{ marginBottom: 8 }}>{includeDecks.size === 0 ? "All decks included." : includeDecks.size + " selected."}</div>
                {decks.map((d) => (
                  <div key={d.name} className="set-row" style={{ padding: "7px 0" }}>
                    <span className="set-label" style={{ fontWeight: 600 }}>{d.name}</span>
                    <Switch on={includeDecks.size === 0 || includeDecks.has(d.name)} onChange={() => toggleDeck(d.name)} label={d.name} />
                  </div>
                ))}
              </div>
            )}
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
