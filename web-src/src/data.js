/* Data layer for Recall.
 *
 * Two halves:
 *   makeSampleRaw()        -> deterministic synthetic "raw" dataset (dev/demo).
 *   buildAnki(raw, config) -> attaches aggregation helpers (trend/period/goals/…)
 *                             on top of a raw dataset.
 *
 * In production, Python (data.py) produces the SAME `raw` shape from the real
 * collection and injects it as window.__RECALL__.data — then buildAnki() runs
 * unchanged. The `raw` contract:
 *
 *   raw = {
 *     today: <epoch ms, UTC midnight of the current Anki day>,
 *     decks: [{ name, retain }],
 *     days:  [{ date:<epoch ms>, dow, studied, reviews, newC, learning,
 *               relearning, total, timeSec, again, hard, good, easy,
 *               retention, deckSplit:{name:count}, mature }],
 *     hourly:   [{ hour, pct, retention } × 24],
 *     forecast: [{ day, young, mature, total } × 30],
 *     fsrs:     { stability, difficulty, retrievability, mature, young,
 *                 retr:[{band, n} × 5] },
 *     records:  [{ label, value, unit, sub }],
 *     achievements: [{ name, desc, icon, got, progress? }],
 *   }
 */

const DAY = 86400000;

// ---- formatting ---------------------------------------------------------
export function fmtDur(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h <= 0) return m + "m";
  return h + "h " + (m < 10 ? "0" + m : m) + "m";
}
export function fmtDurShort(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h <= 0) return m + "m";
  return h + "h " + m + "m";
}
export function compact(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return "" + n;
}
export function fmtDate(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
export const fmt = { fmtDur, fmtDurShort, compact, fmtDate };

// ============================ AGGREGATION ===============================
// Attach helpers (trend/period/goals/deckBoard/streak) onto a raw dataset.
export function buildAnki(raw, config) {
  const TODAY = new Date(raw.today);
  const days = raw.days.map((d) => ({ ...d, date: new Date(d.date) }));
  const decks = raw.decks || [];
  const start = days.length ? days[0].date : TODAY;

  function startOfWeek(date) {
    const d = new Date(date.getTime());
    const dow = (d.getUTCDay() + 6) % 7; // Monday-based
    d.setUTCDate(d.getUTCDate() - dow);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  const sumDays = (list, key) => list.reduce((a, d) => a + (d[key] || 0), 0);
  function avgRetention(list) {
    let rev = 0, again = 0;
    list.forEach((d) => { rev += d.reviews; again += d.again; });
    return rev > 0 ? (rev - again) / rev : 0;
  }

  function rangeList(range) {
    if (range === "week") {
      const ws = startOfWeek(TODAY);
      return days.filter((d) => d.date >= ws);
    } else if (range === "month") {
      const ref = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), 1));
      return days.filter((d) => d.date >= ref);
    }
    const ref = new Date(Date.UTC(TODAY.getUTCFullYear(), 0, 1));
    return days.filter((d) => d.date >= ref);
  }

  // 12 weekly / 12 monthly / per-year buckets for one metric
  function trend(range, metricKey) {
    const buckets = [];
    if (range === "week") {
      const thisWeekStart = startOfWeek(TODAY);
      for (let w = 11; w >= 0; w--) {
        const ws = new Date(thisWeekStart.getTime() - w * 7 * DAY);
        const we = new Date(ws.getTime() + 7 * DAY);
        const list = days.filter((d) => d.date >= ws && d.date < we);
        buckets.push({ label: ws, value: sumDays(list, metricKey), time: sumDays(list, "timeSec"), retention: avgRetention(list) });
      }
    } else if (range === "month") {
      for (let m = 11; m >= 0; m--) {
        const ref = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - m, 1));
        const next = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
        const list = days.filter((d) => d.date >= ref && d.date < next);
        buckets.push({ label: ref, value: sumDays(list, metricKey), time: sumDays(list, "timeSec"), retention: avgRetention(list) });
      }
    } else {
      const yNow = TODAY.getUTCFullYear();
      const yMin = start.getUTCFullYear();
      for (let y = yMin; y <= yNow; y++) {
        const ref = new Date(Date.UTC(y, 0, 1));
        const next = new Date(Date.UTC(y + 1, 0, 1));
        const list = days.filter((d) => d.date >= ref && d.date < next);
        buckets.push({ label: ref, value: sumDays(list, metricKey), time: sumDays(list, "timeSec"), retention: avgRetention(list) });
      }
    }
    return buckets;
  }

  function period(range, metricKey) {
    const list = rangeList(range);
    return {
      cards: sumDays(list, metricKey),
      time: sumDays(list, "timeSec"),
      retention: avgRetention(list),
      newC: sumDays(list, "newC"),
      daysStudied: list.filter((d) => d.studied).length,
      list,
    };
  }

  // All metric totals for the current period (used by goals).
  function periodTotals(range) {
    const list = rangeList(range);
    return {
      total: sumDays(list, "total"),
      reviews: sumDays(list, "reviews"),
      newC: sumDays(list, "newC"),
      learning: sumDays(list, "learning"),
      relearning: sumDays(list, "relearning"),
      time: sumDays(list, "timeSec"),
      daysStudied: list.filter((d) => d.studied).length,
      retention: avgRetention(list),
      list,
    };
  }

  function deckBoard(range) {
    const list = rangeList(range);
    const rows = decks.map((d) => ({ name: d.name, retain: d.retain, cards: 0, time: 0 }));
    rows.forEach((r) => {
      r.cards = list.reduce((a, day) => a + ((day.deckSplit && day.deckSplit[r.name]) || 0), 0);
      r.time = Math.round(r.cards * 9);
    });
    rows.sort((a, b) => b.cards - a.cards);
    return rows;
  }

  // ---- streak ----------------------------------------------------------
  const streakMin = (config && config.data && config.data.streakMinCards) || 1;
  function computeStreakDays() {
    // Count consecutive studied days ending today. If today isn't studied YET,
    // the streak is still alive — count back from yesterday (don't reset to 0).
    let s = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      const ok = days[i].studied && days[i].total >= streakMin;
      if (ok) { s++; }
      else if (i === days.length - 1) { continue; } // today not done yet
      else { break; }
    }
    return s;
  }
  const streakDays = computeStreakDays();
  const totalSessions = days.filter((d) => d.studied).length;
  const lifetimeCards = sumDays(days, "total");
  const matureCount = (raw.fsrs && raw.fsrs.mature) || (days.length ? days[days.length - 1].mature : 0);

  // ---- goals (config-driven) ------------------------------------------
  const RANGE_MULT = { week: 1, month: 4.3, year: 52 };
  function goals(range) {
    const tot = periodTotals(range);
    const mult = RANGE_MULT[range];
    const list = (config && config.goals) || [];
    return list.map((g) => {
      const value = tot[g.source] != null ? tot[g.source] : 0;
      const target = Math.max(1, Math.round((g.weeklyTarget || 0) * mult));
      return { key: g.key, label: g.label, value, target, unit: g.unit, icon: g.icon };
    });
  }

  return {
    TODAY, days, decks,
    hourly: raw.hourly || [], forecast: raw.forecast || [], fsrs: raw.fsrs || {},
    records: raw.records || [], achievements: raw.achievements || [],
    streakDays, totalSessions, matureCount, lifetimeCards,
    startOfWeek, trend, period, periodTotals, deckBoard, goals,
    fmt,
  };
}

// ============================ SAMPLE DATA ===============================
// Deterministic (seeded) synthetic raw dataset — used in the browser and as a
// fallback so the UI always renders something. Mirrors the design handoff.
export function makeSampleRaw() {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20260604);
  const noise = (amt) => 1 + (rnd() * 2 - 1) * amt;

  const TODAY = Date.UTC(2026, 5, 4); // 2026-06-04 (Thu)
  const N_DAYS = 365 * 3 + 60;
  const startMs = TODAY - (N_DAYS - 1) * DAY;

  const DECKS = [
    { name: "日本語 Core", weight: 0.34, retain: 0.90 },
    { name: "Anatomy", weight: 0.24, retain: 0.87 },
    { name: "Pharmacology", weight: 0.16, retain: 0.84 },
    { name: "Algorithms", weight: 0.14, retain: 0.91 },
    { name: "Spanish", weight: 0.12, retain: 0.93 },
  ];

  const days = [];
  for (let i = 0; i < N_DAYS; i++) {
    const dateMs = startMs + i * DAY;
    const dow = new Date(dateMs).getUTCDay();
    const t = i / N_DAYS;
    const ramp = 0.45 + 0.85 * Math.min(1, t * 1.4);
    const weekend = dow === 0 || dow === 6 ? 0.74 : 1.0;
    const seasonal = 1 + 0.12 * Math.sin(i / 28);
    let base = 165 * ramp * weekend * seasonal * noise(0.16);

    const studied = i < N_DAYS - 547 ? rnd() > 0.06 : true;
    if (!studied) base = 0;

    const reviews = Math.max(0, Math.round(base));
    let newC = studied ? Math.round((22 * (1 - t * 0.55)) * noise(0.5)) : 0;
    newC = Math.max(0, Math.min(35, newC));
    const learning = studied ? Math.round(newC * (1.4 + rnd() * 0.8)) : 0;
    const relearning = studied ? Math.round(reviews * (0.07 + rnd() * 0.05)) : 0;
    const total = reviews + newC + learning + relearning;
    const secPerCard = 7.5 + rnd() * 4.5;
    const timeSec = Math.round(total * secPerCard);

    const againRate = 0.10 + (rnd() * 0.06) + (weekend < 1 ? 0.01 : 0);
    const again = Math.round(reviews * againRate);
    const hard = Math.round(reviews * (0.16 + rnd() * 0.05));
    const easy = Math.round(reviews * (0.14 + rnd() * 0.06));
    const good = Math.max(0, reviews - again - hard - easy);
    const retention = reviews > 0 ? (reviews - again) / reviews : 0;

    const deckSplit = {};
    DECKS.forEach((d) => (deckSplit[d.name] = Math.round(total * d.weight * noise(0.25))));

    days.push({ date: dateMs, dow, studied, reviews, newC, learning, relearning, total, timeSec, again, hard, good, easy, retention, deckSplit });
  }

  let mature = 1800;
  days.forEach((d) => {
    mature += d.studied ? Math.round(d.newC * 0.55 + d.reviews * 0.012) : -2;
    d.mature = mature;
  });
  const matureCount = mature;

  const hourShape = [
    1, 0.5, 0.3, 0.2, 0.4, 1.2, 3.5, 6.5, 7.2, 5.0, 3.6, 3.2,
    3.8, 3.0, 2.6, 2.8, 3.4, 4.2, 5.8, 7.8, 8.6, 6.4, 3.8, 2.0,
  ];
  const hourSum = hourShape.reduce((a, b) => a + b, 0);
  const hourly = hourShape.map((w, h) => ({
    hour: h, pct: w / hourSum,
    retention: 0.93 - (h >= 22 || h < 5 ? 0.09 : 0) - rnd() * 0.03,
  }));

  const forecast = [];
  for (let k = 0; k < 30; k++) {
    const base = 150 * (1 - k * 0.012) * noise(0.18);
    const young = Math.max(0, Math.round(base * (0.42 - k * 0.004)));
    const matureDue = Math.max(0, Math.round(base * (0.58 + k * 0.004)));
    forecast.push({ day: k, young, mature: matureDue, total: young + matureDue });
  }

  const sumDays = (list, key) => list.reduce((a, d) => a + (d[key] || 0), 0);
  const bestDay = days.reduce((a, d) => (d.total > a.total ? d : a), days[0]);
  const bestTimeDay = days.reduce((a, d) => (d.timeSec > a.timeSec ? d : a), days[0]);
  let longest = 0, run = 0;
  days.forEach((d) => { if (d.studied) { run++; longest = Math.max(longest, run); } else run = 0; });
  const lifetimeCards = sumDays(days, "total");
  const lifetimeTime = sumDays(days, "timeSec");
  let rev = 0, again2 = 0;
  days.forEach((d) => { rev += d.reviews; again2 += d.again; });
  const lifetimeRetention = rev > 0 ? (rev - again2) / rev : 0;
  const D = (ms) => fmtDate(new Date(ms));

  const records = [
    { label: "Best day", value: bestDay.total.toLocaleString(), unit: "cards", sub: D(bestDay.date) },
    { label: "Longest streak", value: longest.toLocaleString(), unit: "days", sub: "all-time" },
    { label: "Most time / day", value: fmtDur(bestTimeDay.timeSec), unit: "", sub: D(bestTimeDay.date) },
    { label: "Lifetime cards", value: compact(lifetimeCards), unit: "reviews", sub: "since " + D(startMs) },
    { label: "Lifetime focus", value: Math.round(lifetimeTime / 3600).toLocaleString(), unit: "hours", sub: "total study" },
    { label: "True retention", value: Math.round(lifetimeRetention * 100) + "%", unit: "", sub: "all-time avg" },
  ];

  let s = 0;
  for (let i = days.length - 1; i >= 0; i--) { if (days[i].studied) s++; else break; }
  const streakDays = s;

  const fsrs = {
    stability: 64, difficulty: 0.31, retrievability: 0.91,
    mature: matureCount, young: Math.round(matureCount * 0.46),
    retr: [
      { band: "<70%", n: 420 },
      { band: "70–80%", n: 690 },
      { band: "80–90%", n: 2050 },
      { band: "90–95%", n: 3120 },
      { band: ">95%", n: 2480 },
    ],
  };

  const achievements = [
    { name: "Century", desc: "100-day streak", icon: "flame", got: true },
    { name: "Year One", desc: "365 days studied", icon: "calendar", got: true },
    { name: "10k Club", desc: "10,000 reviews", icon: "layers", got: true },
    { name: "Early Bird", desc: "50 sessions before 8am", icon: "sun", got: true },
    { name: "Polyglot", desc: "5 active decks", icon: "globe", got: true },
    { name: "Sharpshooter", desc: "95% week retention", icon: "target", got: true },
    { name: "Marathon", desc: "500 cards in a day", icon: "bolt", got: true },
    { name: "Iron Will", desc: "365-day streak", icon: "shield", got: streakDays >= 365 },
    { name: "Master", desc: "10,000 mature cards", icon: "crown", got: matureCount >= 10000 },
    { name: "Night Owl", desc: "100 late sessions", icon: "moon", got: false, progress: 0.62 },
    { name: "Perfect Month", desc: "30 days, 90%+ each", icon: "star", got: false, progress: 0.8 },
    { name: "Lifer", desc: "100k lifetime reviews", icon: "infinity", got: lifetimeCards >= 100000 },
  ];

  return {
    today: TODAY,
    decks: DECKS.map((d) => ({ name: d.name, retain: d.retain })),
    days, hourly, forecast, fsrs, records, achievements,
  };
}
