/* Window mode: slim top bar (gear + brand), page header + range toggle, the
   single-column card list (order/visibility from config), and the settings
   drawer. Used by the standalone Progress window. */
import React from "react";
import { Icon } from "./icons.jsx";
import { useAddonisMaximusState, visibleSections } from "./useAddonisMaximus.jsx";
import { renderCard } from "./cardmap.jsx";
import { SettingsDrawer } from "./settings.jsx";

function RangeToggle({ value, onChange }) {
  const labels = { day: "Days", week: "Weeks", month: "Month" };
  return (
    <div className="range-toggle">
      {["day", "week", "month"].map((r) => (
        <button key={r} className={value === r ? "active" : ""} onClick={() => onChange(r)}>
          {labels[r] || r[0].toUpperCase() + r.slice(1)}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const { config, setConfig, anki } = useAddonisMaximusState();
  // Range toggle persists via config.ui.range (shared with the carousel).
  const stored = (config.ui && config.ui.range) || "week";
  const range = ["day", "week", "month"].includes(stored) ? stored : "week";
  const setRange = (r) => setConfig({ ...config, ui: { ...config.ui, range: r } });
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  React.useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-theme", config.appearance.theme);
    el.setAttribute("data-radius", config.appearance.corners === "sharp" ? "sharp" : "round");
  }, [config.appearance]);

  const openSettings = () => setSettingsOpen(true);
  const ctx = { anki, config, setConfig, range, chartType: config.appearance.chart, onAddGoal: openSettings, onShare: openSettings, streakBox: 15 };
  const visible = visibleSections(config);

  return (
    <div className="app-shell">
      <div className="topbar">
        <button className="gearbtn" onClick={openSettings} aria-label="Open settings" title="Settings">
          <Icon name="gear" size={20} />
        </button>
        <div className="brand"><span className="mark"><Icon name="brain" size={14} sw={2} /></span>Addonis Maximus</div>
        <div className="spacer" />
        <div className="sync"><Icon name="rotate" size={14} /> Synced just now</div>
      </div>

      <div className="page">
        <div className="wrap">
          <div className="phead">
            <div>
              <h1>
                Your Progress
                <span className="streak-pill"><span className="flame"><Icon name="flame" size={15} fill="currentColor" sw={1.4} /></span>{anki.streakDays}-day streak</span>
              </h1>
              <div className="sub">A Strava-style view of everything you study in Anki.</div>
            </div>
            <RangeToggle value={range} onChange={setRange} />
          </div>

          {visible.length === 0 ? (
            <div className="card"><div className="empty-hint">All cards are hidden. Open <b>Settings</b> (gear, top-left) to turn some back on.</div></div>
          ) : (
            <div className="grid">
              {visible.map((key) => <div key={key}>{renderCard(key, ctx)}</div>)}
            </div>
          )}
        </div>
      </div>

      {settingsOpen && (
        <SettingsDrawer config={config} setConfig={setConfig} anki={anki} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
