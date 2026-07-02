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
 *     projection: [{ deck, mature, young, new, introPerDay, typicalDays,
 *                    samples, eta90Days, eta90Date, series:[{t, mature}],
 *                    milestones:[{pct, count, days, date}] }],
 *     pending:  [{ deck, new, learn, review }],   // cards waiting today, per deck
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
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "Jun '26" — compact month + 2-digit year for the maturity milestone track.
export function monYear(d) {
  return MONTHS[d.getUTCMonth()] + " '" + String(d.getUTCFullYear()).slice(2);
}
// "Jun 2026" — full year for the start/end timeline labels.
export function monthYearFull(d) {
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
}
export const fmt = { fmtDur, fmtDurShort, compact, fmtDate, monYear, monthYearFull };

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
    if (range === "day") {
      // just today's record(s) — used by Goals' "Day" period (carousel only)
      return days.filter((d) => d.date.getTime() === TODAY.getTime());
    }
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

  // ---- month in review -------------------------------------------------
  // Stats for one calendar month, addressed by offset from the current month
  // (0 = this month, -1 = last month, …). `monthSpan` is how many whole months
  // of data exist behind today, so the card can clamp its navigation.
  const firstDay = days.length ? days[0].date : TODAY;
  const monthSpan = (TODAY.getUTCFullYear() - firstDay.getUTCFullYear()) * 12
    + (TODAY.getUTCMonth() - firstDay.getUTCMonth());
  function monthStats(offset) {
    const ref = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() + offset, 1));
    const next = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
    const list = days.filter((d) => d.date >= ref && d.date < next);
    const daysInMonth = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0)).getUTCDate();
    // One bar per calendar day (0 for unstudied / missing days).
    const bars = new Array(daysInMonth).fill(0);
    let best = null;
    list.forEach((d) => {
      bars[d.date.getUTCDate() - 1] = d.total;
      if (!best || d.total > best.total) best = d;
    });
    const isCurrent = offset === 0;
    // Per-deck card counts for the month (from each day's deckSplit).
    const deckTotals = {};
    list.forEach((d) => {
      Object.entries(d.deckSplit || {}).forEach(([name, n]) => {
        deckTotals[name] = (deckTotals[name] || 0) + (n || 0);
      });
    });
    const deckRows = Object.entries(deckTotals)
      .map(([name, cards]) => ({ name, cards }))
      .filter((r) => r.cards > 0)
      .sort((a, b) => b.cards - a.cards);
    return {
      ref, offset, label: fmt.monthYearFull(ref),
      cards: sumDays(list, "total"),
      reviews: sumDays(list, "reviews"),
      newC: sumDays(list, "newC"),
      learning: sumDays(list, "learning"),
      relearning: sumDays(list, "relearning"),
      again: sumDays(list, "again"),
      hard: sumDays(list, "hard"),
      good: sumDays(list, "good"),
      easy: sumDays(list, "easy"),
      time: sumDays(list, "timeSec"),
      retention: avgRetention(list),
      decks: deckRows,
      daysStudied: list.filter((d) => d.studied).length,
      daysInMonth,
      // For the current month only part of it has elapsed; drives "X of Y days".
      daysElapsed: isCurrent ? TODAY.getUTCDate() : daysInMonth,
      isCurrent,
      bestDay: best ? { date: best.date, total: best.total, timeSec: best.timeSec } : null,
      bars,
      hasData: list.some((d) => d.studied),
    };
  }

  // "You vs You" — your biggest study days, ranked by cards cleared (time breaks
  // ties). All-time within the loaded window (same span the Records card uses).
  function topDays(n = 5) {
    return days
      .filter((d) => d.studied)
      .slice()
      .sort((a, b) => b.total - a.total || b.timeSec - a.timeSec)
      .slice(0, n)
      .map((d) => ({ date: d.date, total: d.total, timeSec: d.timeSec, retention: d.retention }));
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
  // "day" scales from the weekly base by 1/7, exactly how month/year scale up.
  const RANGE_MULT = { day: 1 / 7, week: 1, month: 4.3, year: 52 };

  // Source value for an arbitrary day-list, matching periodTotals' semantics
  // (time -> seconds, daysStudied -> count of studied days, else metric sum).
  function sumSource(list, source) {
    if (source === "time") return sumDays(list, "timeSec");
    if (source === "daysStudied") return list.filter((d) => d.studied).length;
    return sumDays(list, source);
  }

  // Average weekly value of a goal source over the user's recent history. Uses up
  // to the last 12 complete weeks (excludes the current partial week so a slow
  // start to this week doesn't drag the target down). This is the "average" goal
  // target — it scales to day/month/year via RANGE_MULT just like a fixed one.
  function avgWeekly(source) {
    const thisWeekStart = startOfWeek(TODAY);
    const windowStart = new Date(thisWeekStart.getTime() - 12 * 7 * DAY);
    let list = days.filter((d) => d.date >= windowStart && d.date < thisWeekStart);
    if (!list.length) list = days.filter((d) => d.date < thisWeekStart);
    if (!list.length) return 0;
    const weeks = Math.max(1, (thisWeekStart.getTime() - list[0].date.getTime()) / (7 * DAY));
    return sumSource(list, source) / weeks;
  }

  function goals(range) {
    const tot = periodTotals(range);
    const mult = RANGE_MULT[range] != null ? RANGE_MULT[range] : 1;
    const list = (config && config.goals) || [];
    return list.map((g) => {
      const value = tot[g.source] != null ? tot[g.source] : 0;
      const mode = g.targetMode || "average";
      // average mode falls back to the configured number when there's no history
      const weeklyBase = mode === "average"
        ? (avgWeekly(g.source) || g.weeklyTarget || 0)
        : (g.weeklyTarget || 0);
      const target = Math.max(1, Math.round(weeklyBase * mult));
      return { key: g.key, label: g.label, value, target, unit: g.unit, icon: g.icon, targetMode: mode };
    });
  }

  return {
    TODAY, days, decks,
    allDecks: raw.allDecks || decks.map((d) => d.name),
    hourly: raw.hourly || [], forecast: raw.forecast || [], fsrs: raw.fsrs || {},
    records: raw.records || [], achievements: raw.achievements || [],
    projection: raw.projection || [], pending: raw.pending || [],
    streakDays, totalSessions, matureCount, lifetimeCards,
    startOfWeek, trend, period, periodTotals, deckBoard, topDays, goals, avgWeekly,
    monthStats, monthSpan,
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
      { band: "95%+", n: 2480 },
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

  // Maturity projection per deck: a plausible easing curve from today's mature
  // count up to the 90% target, like data.py's empirical projection produces.
  const projection = DECKS.map((d) => {
    const total = Math.round(9000 * d.weight);
    const matureNow = Math.round(total * (0.5 + rnd() * 0.18));
    const young = Math.round(total * 0.3);
    const newC2 = Math.max(0, total - matureNow - young);
    const target = Math.ceil(total * 0.9);
    const etaDays = Math.round(130 + rnd() * 320);
    const series = [];
    for (let t = 0; t <= etaDays + 7; t += 7) {
      const p = Math.min(1, t / etaDays);
      series.push({ t: TODAY + t * DAY, mature: matureNow + Math.round((target - matureNow) * (1 - Math.pow(1 - p, 1.6))) });
    }
    // 25/50/75/90% checkpoints with projected day-offsets, mirroring data.py's
    // `milestones`: ease along the same curve to the day each count is reached.
    const milestones = [25, 50, 75, 90].map((pct) => {
      const count = Math.ceil((total * pct) / 100);
      if (matureNow >= count) return { pct, count, days: 0, date: TODAY };
      // invert the easing curve used for `series` to find the crossing day
      const frac = (count - matureNow) / (target - matureNow || 1);
      const days = Math.round(etaDays * (1 - Math.pow(1 - Math.min(1, frac), 1 / 1.6)));
      return { pct, count, days, date: TODAY + days * DAY };
    });
    return {
      deck: d.name, mature: matureNow, young, new: newC2,
      introPerDay: Math.round((3 + rnd() * 9) * 10) / 10,
      typicalDays: Math.round(34 + rnd() * 22), samples: matureNow,
      eta90Days: etaDays, eta90Date: TODAY + etaDays * DAY, milestones, series,
    };
  });

  // Cards waiting today, per deck — a plausible snapshot for the Pending card.
  const pending = DECKS.map((d) => {
    const review = Math.max(0, Math.round(150 * d.weight * noise(0.3)));
    const newC = Math.max(0, Math.round(35 * d.weight * noise(0.5)));
    const learn = Math.max(0, Math.round(review * 0.1 * noise(0.6)));
    return { deck: d.name, new: newC, learn, review };
  })
    .filter((r) => r.new + r.learn + r.review > 0)
    .sort((a, b) => (b.new + b.learn + b.review) - (a.new + a.learn + a.review));

  return {
    today: TODAY,
    decks: DECKS.map((d) => ({ name: d.name, retain: d.retain })),
    allDecks: DECKS.map((d) => d.name),
    days, hourly, forecast, fsrs, records, achievements, projection, pending,
  };
}
