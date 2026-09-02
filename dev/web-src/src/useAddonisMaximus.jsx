/* Shared state for both mounts: raw dataset + config + persistence + the
   built `anki` aggregator. Config changes persist; a data-scope change asks
   Python to recompute and push a fresh dataset back. */
import React from "react";
import { buildAnki, makeSampleRaw } from "./data.js";
import { loadConfig, saveConfig, getInitialData, requestReload, onData } from "./config.js";

// The only config.data keys Python's build_dataset actually reads (data.py:50,
// 84, 100, 105). streakMinCards is deliberately absent — it is applied purely in
// JS (data.js), so asking Python to recompute after it changes rebuilds the
// whole collection for a byte-identical dataset.
const PY_DATA_KEYS = ["includeDecks", "cutoffHour", "matureThresholdDays", "excludeSuspended"];
const pyScope = (cfg) =>
  JSON.stringify(PY_DATA_KEYS.map((k) => (cfg && cfg.data ? cfg.data[k] : undefined)));

export function useAddonisMaximusState() {
  const [raw, setRaw] = React.useState(() => getInitialData() || makeSampleRaw());
  const [config, setConfigState] = React.useState(() => loadConfig());
  const anki = React.useMemo(() => buildAnki(raw, config), [raw, config]);

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

  React.useEffect(() => { onData((newRaw) => setRaw(newRaw)); }, []);

  return { raw, config, setConfig, anki };
}

export function visibleSections(config) {
  const hidden = new Set(config.sections.hidden);
  return config.sections.order.filter((k) => !hidden.has(k));
}
