/* Config + host bridge.
 *
 * In Anki, Python injects `window.__ADDONISMAXIMUS__ = { config, data }` before the app
 * boots and provides `pycmd` (AnkiWebView). We persist via the bridge:
 *   pycmd("addonismaximus:save:" + JSON.stringify(config))   -> Python writes config.json
 *   pycmd("addonismaximus:reload")                            -> Python recomputes data,
 *                                                        then calls window.addonismaximusSetData(json)
 *
 * In a plain browser (dev), there is no pycmd — we fall back to localStorage so
 * the panel is fully usable against sample data.
 */

// Section keys, in their canonical order. The settings panel reorders/hides
// these; `meta` is display info.
export const SECTIONS = [
  { key: "goals", label: "Goals", icon: "target" },
  { key: "activity", label: "Activity", icon: "layers" },
  { key: "overview", label: "Activity & Streak", icon: "layers" },
  { key: "month", label: "Month in Review", icon: "calendar" },
  { key: "streak", label: "Streak calendar", icon: "flame" },
  { key: "pending", label: "Pending today", icon: "cards" },
  { key: "pace", label: "Hours left (pace)", icon: "gauge" },
  { key: "forecast", label: "Forecast", icon: "calendar" },
  { key: "answerButtons", label: "Answer buttons", icon: "gauge" },
  { key: "hourly", label: "When you study best", icon: "clock" },
  { key: "bestDays", label: "You vs You (best days)", icon: "bolt" },
  { key: "maturity", label: "Deck maturity ETA", icon: "seedling" },
  { key: "time", label: "Time spent", icon: "clock" },
];

// Cards the carousel ships turned ON. Everything else in SECTIONS starts hidden
// and is enabled in Settings → Cards & sections. Listed by key (not a slice of
// SECTIONS) so inserting a card never silently hides a different one.
export const DEFAULT_VISIBLE = ["goals", "activity", "overview", "month", "streak", "pending"];

export const GOAL_SOURCES = [
  { value: "total", label: "Cards studied", unit: "count" },
  { value: "reviews", label: "Reviews", unit: "count" },
  { value: "newC", label: "New cards", unit: "count" },
  { value: "time", label: "Study time", unit: "time" },
  { value: "daysStudied", label: "Days studied", unit: "days" },
];

export const DEFAULT_CONFIG = {
  version: 1,
  // textScale multiplies the carousel zoom (1 = default size). The Text size
  // control in Settings sets it; everything scales proportionally.
  // viewMode: "multi" (the default view) = the three stacked blocks
  // (rings / graph / heat-map), no swiping; "single" = the swipe carousel, one
  // card at a time. stageHeight is the carousel's card height in pre-zoom px
  // (single mode only).
  // blocks = which card fills each of multi mode's three slots, by card key; the
  // pencil in a band's corner rewrites it. MUST stay in sync with config_store.py.
  appearance: { theme: "strava", chart: "area", corners: "round", textScale: 1, viewMode: "multi", stageHeight: 320, blocks: ["goals", "activity", "streak"] },
  sections: {
    order: SECTIONS.map((s) => s.key),
    // The carousel ships lean — only DEFAULT_VISIBLE is on; users turn the rest
    // on in Settings → Cards & sections.
    hidden: SECTIONS.map((s) => s.key).filter((k) => !DEFAULT_VISIBLE.includes(k)),
    // Which card the home-screen carousel opens on (a section key). Falls back to
    // the first visible card if this one is hidden/unknown. Carousel-only.
    defaultCard: "overview",
  },
  // targetMode: "average" = target tracks the user's recent weekly average for the
  // source; "fixed" = use weeklyTarget. weeklyTarget is kept as the fallback/Custom
  // value. Targets scale to day/week/month/year automatically.
  goals: [
    { key: "cards", label: "Cards", icon: "layers", source: "total", unit: "count", targetMode: "average", weeklyTarget: 1200 },
    { key: "time", label: "Study Time", icon: "clock", source: "time", unit: "time", targetMode: "average", weeklyTarget: 25200 },
    { key: "new", label: "New Cards", icon: "plus", source: "newC", unit: "count", targetMode: "average", weeklyTarget: 120 },
    { key: "days", label: "Days Studied", icon: "check", source: "daysStudied", unit: "days", targetMode: "average", weeklyTarget: 7 },
  ],
  data: {
    includeDecks: [],          // [] = all decks
    cutoffHour: null,          // null = use Anki's rollover hour
    matureThresholdDays: 21,
    streakMinCards: 1,
    excludeSuspended: false,   // drop suspended cards from the maturity pipeline
  },
  // Which deck the Maturity ETA card tracks ("" = auto: the largest deck).
  // Display-only — switching decks never triggers a collection rescan.
  maturity: { deck: "" },
  // Remembered view state (not a user-facing setting): the Week/Month/Year — and
  // Day, on Goals — time-range toggle. Persisted so returning from study, which
  // re-mounts the carousel, keeps the range the user last picked instead of
  // snapping back to "week". MUST stay in sync with config_store.py.
  ui: { range: "week" },
};

// ---- deep merge (objects only; arrays replace) --------------------------
function isObj(x) { return x && typeof x === "object" && !Array.isArray(x); }
export function deepMerge(base, over) {
  if (!isObj(base)) return over === undefined ? base : over;
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!isObj(over)) return out;
  for (const k of Object.keys(over)) {
    out[k] = isObj(base[k]) && isObj(over[k]) ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}

const host = () => (typeof window !== "undefined" ? window.__ADDONISMAXIMUS__ : null);
const hasBridge = () => typeof window !== "undefined" && typeof window.pycmd === "function";
const LS_KEY = "addonismaximus.config";

export function loadConfig() {
  let stored = null;
  const h = host();
  if (h && h.config) stored = h.config;
  else if (typeof localStorage !== "undefined") {
    try { stored = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (_) { stored = null; }
  }
  // Sections may gain keys across versions — union the stored order with any
  // newly-added section keys so a new card never silently disappears.
  const merged = deepMerge(DEFAULT_CONFIG, stored || {});
  const known = SECTIONS.map((s) => s.key);
  const ordered = merged.sections.order.filter((k) => known.includes(k));
  for (const k of known) if (!ordered.includes(k)) ordered.push(k);
  merged.sections.order = ordered;
  merged.sections.hidden = merged.sections.hidden.filter((k) => known.includes(k));
  return merged;
}

export function saveConfig(cfg) {
  if (hasBridge()) {
    window.pycmd("addonismaximus:save:" + JSON.stringify(cfg));
  } else if (typeof localStorage !== "undefined") {
    try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch (_) {}
  }
}

// Raw dataset injected by Python; null in the browser (caller uses sample data).
export function getInitialData() {
  const h = host();
  return h && h.data ? h.data : null;
}

// Ask Python to recompute the dataset (e.g. after a data-scope change).
export function requestReload() {
  if (hasBridge()) window.pycmd("addonismaximus:reload");
}

// Register a callback for when Python pushes a fresh dataset.
export function onData(cb) {
  if (typeof window !== "undefined") window.addonismaximusSetData = (raw) => cb(raw);
}

// Absolute base path for bundled assets (fonts). Anki injects an absolute
// /_addons/<pkg>/web path; standalone in a browser we use a relative "." .
export function webBase() {
  const h = host();
  return (h && h.webBase) || ".";
}

// "embed" (carousel on the home screen) or "window" (full dialog). In a plain
// browser, ?embed=1 forces the carousel for previewing.
export function appMode() {
  const h = host();
  if (h && h.mode) return h.mode;
  if (typeof location !== "undefined" && new URLSearchParams(location.search).get("embed")) return "embed";
  // dev-only: persist a preview mode so the browser preview can show the embed.
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("addonismaximus.preview") === "embed") return "embed";
  } catch (_) {}
  return "window";
}
