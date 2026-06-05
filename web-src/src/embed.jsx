/* Embedded mode: a compact carousel that lives on Anki's home screen below the
   heatmap. One enabled card at a time; arrows / dots / swipe move between them.
   - Surfaces blend with Anki's own background (read at runtime).
   - Every card is scaled to fit one height, so flipping never needs scrolling. */
import React from "react";
import { Icon } from "./icons.jsx";
import { useRecallState, visibleSections } from "./useRecall.jsx";
import { renderCard } from "./cardmap.jsx";
import { SettingsDrawer } from "./settings.jsx";

const MAX_H = 480; // cards taller than this scale down to fit
const MIN_H = 240; // keep short cards from looking cramped

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
  const [fit, setFit] = React.useState({ scale: 1, h: MIN_H });
  const dragX = React.useRef(null);
  const contentRef = React.useRef(null);

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

  // Fit the current card to one height: scale down if taller than MAX_H. Charts
  // size themselves asynchronously, so re-measure on resize + a couple of ticks.
  React.useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      const nat = el.offsetHeight || 0; // pre-transform layout height
      if (!nat) return;
      const scale = nat > MAX_H ? MAX_H / nat : 1;
      const h = Math.max(MIN_H, Math.min(MAX_H, Math.round(nat * scale)));
      setFit((prev) => (prev.h === h && Math.abs(prev.scale - scale) < 0.001 ? prev : { scale, h }));
    };
    measure();
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); });
    ro.observe(el);
    const t1 = setTimeout(measure, 80);
    const t2 = setTimeout(measure, 300);
    return () => { ro.disconnect(); clearTimeout(t1); clearTimeout(t2); cancelAnimationFrame(raf); };
  }, [cur, range, n]);

  const go = (d) => setIdx(() => (n ? (safeIdx + d + n) % n : 0));
  const onPointerDown = (e) => { dragX.current = e.clientX; };
  const onPointerUp = (e) => {
    if (dragX.current == null) return;
    const dx = e.clientX - dragX.current;
    dragX.current = null;
    if (Math.abs(dx) > 45 && n > 1) go(dx < 0 ? 1 : -1);
  };

  const openSettings = () => setSettingsOpen(true);
  const ctx = { anki, range, chartType: config.appearance.chart, onAddGoal: openSettings };

  return (
    <div className="embed">
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
          <div className="embed-stage" style={{ height: fit.h }} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
            <div className="embed-scaler" style={{ transform: `scale(${fit.scale})` }}>
              <div className="fade" key={cur + range} ref={contentRef}>{renderCard(cur, ctx)}</div>
            </div>
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

      {settingsOpen && (
        <SettingsDrawer config={config} setConfig={setConfig} anki={anki} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
