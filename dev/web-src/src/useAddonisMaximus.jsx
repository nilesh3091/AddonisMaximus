/* Shared state for both mounts: raw dataset + config + persistence + the
   built `anki` aggregator. Config changes persist; a data-scope change asks
   Python to recompute and push a fresh dataset back. */
import React from "react";
import { buildAnki, makeSampleRaw } from "./data.js";
import { loadConfig, saveConfig, getInitialData, requestReload, onData } from "./config.js";

export function useAddonisMaximusState() {
  const [raw, setRaw] = React.useState(() => getInitialData() || makeSampleRaw());
  const [config, setConfigState] = React.useState(() => loadConfig());
  const anki = React.useMemo(() => buildAnki(raw, config), [raw, config]);

  const setConfig = React.useCallback((next) => {
    setConfigState((prev) => {
      saveConfig(next);
      if (JSON.stringify(prev.data) !== JSON.stringify(next.data)) requestReload();
      return next;
    });
  }, []);

  React.useEffect(() => { onData((newRaw) => setRaw(newRaw)); }, []);

  return { raw, config, setConfig, anki };
}

export function visibleSections(config) {
  const hidden = new Set(config.sections.hidden);
  return config.sections.order.filter((k) => !hidden.has(k));
}
