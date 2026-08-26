/* Embedded mode: a compact carousel on Anki's home screen below the heatmap.
   One enabled card at a time; arrows / dots / swipe move between them.
   - Surfaces blend with Anki's own background (read at runtime).
   - The whole carousel is sized down via a single zoom (`.embed-inner`), and
     cards keep their natural height, so nothing is ever clipped. */
import React from "react";
import { Icon } from "./icons.jsx";
import { useAddonisMaximusState, visibleSections } from "./useAddonisMaximus.jsx";
import { renderCard } from "./cardmap.jsx";
import { MultiView } from "./cards-core.jsx";
import { SettingsDrawer } from "./settings.jsx";

function RangeToggle({ value, onChange, disabled, options = ["day", "week", "month"] }) {
  const labels = { day: "Days", week: "Weeks", month: "Month" };
  return (
    <div className={"range-toggle" + (disabled ? " disabled" : "")}
      title={disabled ? "This view isn’t affected by the time range" : undefined}>
      {options.map((r) => (
        <button key={r} className={value === r ? "active" : ""} disabled={disabled} onClick={() => !disabled && onChange(r)}>
          {labels[r] || r[0].toUpperCase() + r.slice(1)}
        </button>
      ))}
    </div>
  );
}

// Cards whose contents actually change with the Week/Month/Year range.
const RANGE_CARDS = new Set(["goals", "activity", "overview", "answerButtons", "time"]);

// Single mode gives every card the same stage height, so flipping between them
// never resizes Anki's page. Settings → Appearance → Card height sets it.
const DEFAULT_STAGE_H = 320;

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
  const { config, setConfig, anki } = useAddonisMaximusState();
  // The time-range toggle is persisted (config.ui.range) rather than ephemeral
  // state, so returning from study — which re-mounts this carousel — keeps the
  // range the user picked instead of resetting to "week".
  const range = (config.ui && config.ui.range) || "week";
  const setRange = (r) => setConfig({ ...config, ui: { ...config.ui, range: r } });
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [idx, setIdx] = React.useState(() => {
    const vis = visibleSections(config);
    const d = config.sections.defaultCard;
    const i = d ? vis.indexOf(d) : -1;
    return i >= 0 ? i : 0;
  });
  const dragX = React.useRef(null);

  // Open the carousel on the user's chosen default card, and jump to it live
  // when they change the choice in Settings. Falls back to the first card.
  const defaultCard = config.sections.defaultCard;
  React.useEffect(() => {
    const vis = visibleSections(config);
    const i = defaultCard ? vis.indexOf(defaultCard) : -1;
    if (i >= 0) setIdx(i);
  }, [defaultCard]);

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
  const rangeOptions = ["day", "week", "month"];
  const effRange = (range === "year") ? "month" : range;
  // "multi" drops the carousel entirely for three stacked blocks; the panel is
  // then natural height, so the stage height only matters in single mode.
  const multi = config.appearance.viewMode === "multi";
  const stageH = Number(config.appearance.stageHeight) || DEFAULT_STAGE_H;
  // Text size: scale the single carousel zoom so fonts, rings, charts and spacing
  // all grow/shrink together. base 0.656 × multiplier (default 1). It rides on the
  // element in *render* rather than being poked onto the host in an effect, so a
  // new zoom is committed before the cards' layout effects measure their column —
  // set after paint, everything that sizes itself from a measurement (the heat-map
  // above all) would still be laid out for the previous text size.
  const zoom = 0.656 * (Number(config.appearance.textScale) || 1);

  React.useEffect(() => {
    if (host) host.style.setProperty("--embed-stage-h", stageH + "px");
  }, [host, stageH]);

  const go = (d) => setIdx((prev) => { const c = n ? Math.min(prev, n - 1) : 0; return n ? (c + d + n) % n : 0; });
  const onPointerDown = (e) => { dragX.current = e.clientX; };
  const onPointerUp = (e) => {
    if (dragX.current == null) return;
    const dx = e.clientX - dragX.current;
    dragX.current = null;
    if (Math.abs(dx) > 45 && n > 1) go(dx < 0 ? 1 : -1);
  };

  const openSettings = () => setSettingsOpen(true);
  const ctx = { anki, config, setConfig, range: effRange, chartType: config.appearance.chart, onAddGoal: openSettings, compact: true, streakBox: 17 };

  return (
    <div className="embed blend">
      <div className="embed-inner" style={{ "--embed-zoom": zoom }}>
        <div className="embed-bar">
          <button className="gearbtn" onClick={openSettings} aria-label="Open settings" title="Settings"><Icon name="gear" size={19} /></button>
          <div className="spacer" />
          <RangeToggle value={effRange} onChange={setRange} disabled={!multi && !RANGE_CARDS.has(cur)} options={rangeOptions} />
        </div>

        {multi ? (
          <div className="embed-multi">
            <MultiView anki={anki} range={effRange} chartType={config.appearance.chart}
              onAddGoal={openSettings} compact />
          </div>
        ) : n === 0 ? (
          <div className="card"><div className="empty-hint">No cards enabled. Open <b>Settings</b> (gear) to turn some on.</div></div>
        ) : (
          <>
            <div className="embed-stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
              <div className="fade" key={cur + effRange}>{renderCard(cur, ctx)}</div>
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
