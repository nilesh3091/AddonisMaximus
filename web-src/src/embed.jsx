/* Embedded mode: a compact carousel on Anki's home screen below the heatmap.
   One enabled card at a time; arrows / dots / swipe move between them.
   - Surfaces blend with Anki's own background (read at runtime).
   - The whole carousel is sized down via a single zoom (`.embed-inner`), and
     cards keep their natural height, so nothing is ever clipped. */
import React from "react";
import { Icon } from "./icons.jsx";
import { useRecallState, visibleSections } from "./useRecall.jsx";
import { renderCard } from "./cardmap.jsx";
import { SettingsDrawer } from "./settings.jsx";

function RangeToggle({ value, onChange }) {
  return (
    <div className="range-toggle">
      {["week", "month", "year"].map((r) => (
        <button key={r} className={value === r ? "active" : ""} onClick={() => onChange(r)}>
          {r[0].toUpperCase() + r.slice(1)}
        </button>
      ))}
    </div>
  );
}

// Make the embed's card surfaces blend into Anki's page instead of being dark
// boxes. We keep the theme's accent; only the neutral surfaces are overridden.
function applyAnkiSurfaces(host) {
  try {
    const cs = getComputedStyle(document.documentElement);
    const pick = (...names) => {
      for (const n of names) {
        const v = cs.getPropertyValue(n).trim();
        if (v) return v;
      }
      return "";
    };
    let base = pick("--canvas", "--window-bg");
    if (!base) {
      try { base = getComputedStyle(document.body).backgroundColor; } catch (_) {}
    }
    if (!base || base === "transparent" || base === "rgba(0, 0, 0, 0)") return;
    const elevated = pick("--canvas-elevated", "--canvas-inset", "--frame-bg");
    const border = pick("--border", "--border-subtle");
    const fg = pick("--fg", "--text-fg");
    const S = (k, v) => host.style.setProperty(k, v);
    S("--bg", base);
    S("--bg2", base);
    S("--card", elevated || `color-mix(in srgb, ${base}, #fff 6%)`);
    S("--card2", elevated ? `color-mix(in srgb, ${elevated}, #fff 5%)` : `color-mix(in srgb, ${base}, #fff 12%)`);
    if (border) S("--border", border);
    if (fg) {
      S("--text", fg);
      S("--text2", `color-mix(in srgb, ${fg}, ${base} 35%)`);
      S("--text3", `color-mix(in srgb, ${fg}, ${base} 55%)`);
    }
  } catch (_) {}
}

export function EmbeddedApp({ host }) {
  const { config, setConfig, anki } = useRecallState();
  const [range, setRange] = React.useState("week");
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [idx, setIdx] = React.useState(0);
  const dragX = React.useRef(null);

  React.useEffect(() => {
    if (!host) return;
    host.setAttribute("data-theme", config.appearance.theme);
    host.setAttribute("data-radius", config.appearance.corners === "sharp" ? "sharp" : "round");
    applyAnkiSurfaces(host);
  }, [host, config.appearance]);

  const visible = visibleSections(config);
  const n = visible.length;
  const safeIdx = n ? Math.min(idx, n - 1) : 0;
  const cur = visible[safeIdx];

  const go = (d) => setIdx((prev) => { const c = n ? Math.min(prev, n - 1) : 0; return n ? (c + d + n) % n : 0; });
  const onPointerDown = (e) => { dragX.current = e.clientX; };
  const onPointerUp = (e) => {
    if (dragX.current == null) return;
    const dx = e.clientX - dragX.current;
    dragX.current = null;
    if (Math.abs(dx) > 45 && n > 1) go(dx < 0 ? 1 : -1);
  };

  const openSettings = () => setSettingsOpen(true);
  const ctx = { anki, range, chartType: config.appearance.chart, onAddGoal: openSettings, compact: true };

  return (
    <div className="embed">
      <div className="embed-inner">
        <div className="embed-bar">
          <button className="gearbtn" onClick={openSettings} aria-label="Open settings" title="Settings"><Icon name="gear" size={19} /></button>
          <div className="ebrand"><span className="mark"><Icon name="brain" size={13} sw={2} /></span>Recall</div>
          <span className="streak-pill"><span className="flame"><Icon name="flame" size={13} fill="currentColor" sw={1.4} /></span>{anki.streakDays}d</span>
          <div className="spacer" />
          <RangeToggle value={range} onChange={setRange} />
        </div>

        {n === 0 ? (
          <div className="card"><div className="empty-hint">No cards enabled. Open <b>Settings</b> (gear) to turn some on.</div></div>
        ) : (
          <>
            <div className="embed-stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
              <div className="fade" key={cur + range}>{renderCard(cur, ctx)}</div>
            </div>
            {n > 1 && (
              <div className="embed-nav">
                <button className="embed-arrow" onClick={() => go(-1)} aria-label="Previous card"><Icon name="chevronL" size={17} /></button>
                <div className="embed-dots">
                  {visible.map((k, i) => (
                    <button key={k} className={"embed-dot" + (i === safeIdx ? " active" : "")} onClick={() => setIdx(i)} aria-label={"Card " + (i + 1)} />
                  ))}
                </div>
                <button className="embed-arrow" onClick={() => go(1)} aria-label="Next card"><Icon name="chevronR" size={17} /></button>
              </div>
            )}
          </>
        )}
      </div>

      {settingsOpen && (
        <SettingsDrawer config={config} setConfig={setConfig} anki={anki} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
