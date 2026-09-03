/* Shared state for both mounts: raw dataset + config + persistence + the
   built `anki` aggregator. Config changes persist; a data-scope change asks
   Python to recompute and push a fresh dataset back. */
import React from "react";
import { buildAnki, makeSampleRaw } from "./data.js";
import { loadConfig, saveConfig, getInitialData, getDataState, requestReload, announceReady, onData } from "./config.js";

// The only config.data keys Python's build_dataset actually reads (data.py:50,
// 84, 100, 105). streakMinCards is deliberately absent — it is applied purely in
// JS (data.js), so asking Python to recompute after it changes rebuilds the
// whole collection for a byte-identical dataset.
const PY_DATA_KEYS = ["includeDecks", "cutoffHour", "matureThresholdDays", "excludeSuspended"];

// Python skips the maturity projection — the most expensive half of the build —
// unless the Maturity ETA card is actually on screen, and keys its cache on that
// answer. MIRROR of core.wants_projection: a dataset built without it carries
// projection: [], so turning the card on has to ask for a rebuild or the card
// reads "Not enough history yet" until the next collection write.
const wantsProjection = (cfg) => {
  try {
    const hidden = (cfg.sections && cfg.sections.hidden) || [];
    if (!hidden.includes("maturity")) return true;
    const blocks = (cfg.appearance && cfg.appearance.blocks) || [];
    return blocks.includes("maturity");
  } catch (_) {
    return true;
  }
};

const pyScope = (cfg) =>
  JSON.stringify([
    ...PY_DATA_KEYS.map((k) => (cfg && cfg.data ? cfg.data[k] : undefined)),
    wantsProjection(cfg || {}),
  ]);

export function useAddonisMaximusState() {
  const [raw, setRaw] = React.useState(() => getInitialData() || makeSampleRaw());
  const [config, setConfigState] = React.useState(() => loadConfig());
  const anki = React.useMemo(() => buildAnki(raw, config), [raw, config]);
  // True while Python is building the dataset on a background thread. `raw` is
  // still the sample collection at that point, so callers must render a
  // placeholder rather than cards — sample numbers under the user's own heading
  // are worse than a short wait.
  const [loading, setLoading] = React.useState(() => getDataState() === "loading");

  // A reload is an uncached, full-collection rebuild on Anki's main thread. The
  // number fields under Settings → Data & collection fire onChange per keystroke,
  // so typing "45" used to queue several of them back to back — seconds of frozen
  // UI on a large collection. Coalesce into one trailing call.
  const reloadTimer = React.useRef(null);
  const scheduleReload = React.useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => {
      reloadTimer.current = null;
      requestReload();
    }, 500);
  }, []);
  React.useEffect(() => () => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
  }, []);

  const setConfig = React.useCallback((next) => {
    setConfigState((prev) => {
      saveConfig(next);
      if (pyScope(prev) !== pyScope(next)) scheduleReload();
      return next;
    });
  }, [scheduleReload]);

  // Python pushes the finished dataset here — or null if the build failed, in
  // which case we stop waiting and let the sample fallback stand, exactly as an
  // unavailable collection has always behaved.
  React.useEffect(() => {
    onData((newRaw) => {
      setLoading(false);
      if (newRaw) setRaw(newRaw);
    });
    // Register the callback FIRST, then say we're here — otherwise Python could
    // answer before there is anything to answer to.
    if (getDataState() === "loading") announceReady();
  }, []);

  return { raw, config, setConfig, anki, loading };
}

export function visibleSections(config) {
  const hidden = new Set(config.sections.hidden);
  return config.sections.order.filter((k) => !hidden.has(k));
}
