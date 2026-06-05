/* Anki × Strava add-on — synthetic but realistic study data.
   Deterministic (seeded) so charts are stable across reloads.
   Exposes window.ANKI with daily history + aggregation helpers. */
(function () {
  "use strict";

  // ---- seeded RNG ---------------------------------------------------------
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

  // ---- timeline -----------------------------------------------------------
  // "today" fixed for determinism.
  const TODAY = new Date(Date.UTC(2026, 5, 4)); // 2026-06-04 (Thu)
  const DAY = 86400000;
  const N_DAYS = 365 * 3 + 60; // ~3y + buffer
  const start = new Date(TODAY.getTime() - (N_DAYS - 1) * DAY);

  const DECKS = [
    { name: "日本語 Core", weight: 0.34, color: "deck1", retain: 0.90 },
    { name: "Anatomy", weight: 0.24, color: "deck2", retain: 0.87 },
    { name: "Pharmacology", weight: 0.16, color: "deck3", retain: 0.84 },
    { name: "Algorithms", weight: 0.14, color: "deck4", retain: 0.91 },
    { name: "Spanish", weight: 0.12, color: "deck5", retain: 0.93 },
  ];

  const days = [];
  for (let i = 0; i < N_DAYS; i++) {
    const date = new Date(start.getTime() + i * DAY);
    const dow = date.getUTCDay(); // 0 Sun..6 Sat
    const t = i / N_DAYS; // 0..1 growth over time

    // ramp: started light, grew, plateaued. weekend dip.
    const ramp = 0.45 + 0.85 * Math.min(1, t * 1.4);
    const weekend = dow === 0 || dow === 6 ? 0.74 : 1.0;
    const seasonal = 1 + 0.12 * Math.sin(i / 28); // monthly wobble
    let base = 165 * ramp * weekend * seasonal * noise(0.16);

    // a few rest days deep in the past (keeps a long current streak intact)
    const studied = i < N_DAYS - 547 ? rnd() > 0.06 : true;
    if (!studied) base = 0;

    const reviews = Math.max(0, Math.round(base));
    // new cards: capped daily intro, tapers as you progress, sometimes 0
    let newC = studied ? Math.round((22 * (1 - t * 0.55)) * noise(0.5)) : 0;
    newC = Math.max(0, Math.min(35, newC));
    const learning = studied ? Math.round(newC * (1.4 + rnd() * 0.8)) : 0;
    const relearning = studied ? Math.round(reviews * (0.07 + rnd() * 0.05)) : 0;

    const total = reviews + newC + learning + relearning;
    const secPerCard = 7.5 + rnd() * 4.5;
    const timeSec = Math.round(total * secPerCard);

    // answer buttons on review cards
    const againRate = 0.10 + (rnd() * 0.06) + (weekend < 1 ? 0.01 : 0);
    const again = Math.round(reviews * againRate);
    const hard = Math.round(reviews * (0.16 + rnd() * 0.05));
    const easy = Math.round(reviews * (0.14 + rnd() * 0.06));
    const good = Math.max(0, reviews - again - hard - easy);
    const retention = reviews > 0 ? (reviews - again) / reviews : 0;

    // per-deck split of total cards
    const deckSplit = {};
    DECKS.forEach((d) => (deckSplit[d.name] = Math.round(total * d.weight * noise(0.25))));

    days.push({
      i, date, dow, studied,
      reviews, newC, learning, relearning, total,
      timeSec, again, hard, good, easy, retention, deckSplit,
    });
  }

  // ---- mature-card accumulation (for "memory" growth) --------------------
  let mature = 1800;
  days.forEach((d) => {
    mature += d.studied ? Math.round(d.newC * 0.55 + d.reviews * 0.012) : -2;
    d.mature = mature;
  });

  // ---- hourly distribution (avg session shape) ---------------------------
  // when-you-study-best: bimodal (morning commute + evening)
  const hourShape = [
    1, 0.5, 0.3, 0.2, 0.4, 1.2, 3.5, 6.5, 7.2, 5.0, 3.6, 3.2,
    3.8, 3.0, 2.6, 2.8, 3.4, 4.2, 5.8, 7.8, 8.6, 6.4, 3.8, 2.0,
  ];
  const hourSum = hourShape.reduce((a, b) => a + b, 0);
  const hourly = hourShape.map((w, h) => ({
    hour: h,
    pct: w / hourSum,
    // retention dips late at night
    retention: 0.93 - (h >= 22 || h < 5 ? 0.09 : 0) - rnd() * 0.03,
  }));

  // ---- helpers ------------------------------------------------------------
  const METRICS = {
    total: { key: "total", label: "Total", icon: "layers" },
    reviews: { key: "reviews", label: "Reviews", icon: "repeat" },
    newC: { key: "newC", label: "New Cards", icon: "plus" },
    learning: { key: "learning", label: "Learning", icon: "seedling" },
    relearning: { key: "relearning", label: "Relearning", icon: "rotate" },
  };

  function startOfWeek(date) {
    // Monday-based
    const d = new Date(date.getTime());
    const dow = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dow);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  function sumDays(list, key) {
    return list.reduce((a, d) => a + (d[key] || 0), 0);
  }
  function avgRetention(list) {
    let rev = 0, again = 0;
    list.forEach((d) => { rev += d.reviews; again += d.again; });
    return rev > 0 ? (rev - again) / rev : 0;
  }

  // Build trend buckets for a given range + metric.
  // range: 'week' -> 12 weekly buckets; 'month' -> 12 monthly; 'year' -> N yearly
  function trend(range, metricKey) {
    const buckets = [];
    if (range === "week") {
      const thisWeekStart = startOfWeek(TODAY);
      for (let w = 11; w >= 0; w--) {
        const ws = new Date(thisWeekStart.getTime() - w * 7 * DAY);
        const we = new Date(ws.getTime() + 7 * DAY);
        const list = days.filter((d) => d.date >= ws && d.date < we);
        buckets.push({
          label: ws,
          value: sumDays(list, metricKey),
          time: sumDays(list, "timeSec"),
          retention: avgRetention(list),
        });
      }
    } else if (range === "month") {
      for (let m = 11; m >= 0; m--) {
        const ref = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - m, 1));
        const next = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
        const list = days.filter((d) => d.date >= ref && d.date < next);
        buckets.push({
          label: ref,
          value: sumDays(list, metricKey),
          time: sumDays(list, "timeSec"),
          retention: avgRetention(list),
        });
      }
    } else {
      const yNow = TODAY.getUTCFullYear();
      const yMin = start.getUTCFullYear();
      for (let y = yMin; y <= yNow; y++) {
        const ref = new Date(Date.UTC(y, 0, 1));
        const next = new Date(Date.UTC(y + 1, 0, 1));
        const list = days.filter((d) => d.date >= ref && d.date < next);
        buckets.push({
          label: ref,
          value: sumDays(list, metricKey),
          time: sumDays(list, "timeSec"),
          retention: avgRetention(list),
        });
      }
    }
    return buckets;
  }

  // Current-period headline (this week / month / year)
  function period(range, metricKey) {
    let list;
    if (range === "week") {
      const ws = startOfWeek(TODAY);
      list = days.filter((d) => d.date >= ws);
    } else if (range === "month") {
      const ref = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), 1));
      list = days.filter((d) => d.date >= ref);
    } else {
      const ref = new Date(Date.UTC(TODAY.getUTCFullYear(), 0, 1));
      list = days.filter((d) => d.date >= ref);
    }
    return {
      cards: sumDays(list, metricKey),
      time: sumDays(list, "timeSec"),
      retention: avgRetention(list),
      newC: sumDays(list, "newC"),
      daysStudied: list.filter((d) => d.studied).length,
      list,
    };
  }

  // ---- streak -------------------------------------------------------------
  function computeStreakDays() {
    // count consecutive studied days ending today
    let s = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].studied) s++; else break;
    }
    return s;
  }
  const streakDays = computeStreakDays();
  const totalSessions = days.filter((d) => d.studied).length;

  // ---- forecast (cards due ahead) ----------------------------------------
  const forecast = [];
  for (let k = 0; k < 30; k++) {
    const base = 150 * (1 - k * 0.012) * noise(0.18);
    const young = Math.max(0, Math.round(base * (0.42 - k * 0.004)));
    const matureDue = Math.max(0, Math.round(base * (0.58 + k * 0.004)));
    forecast.push({ day: k, young, mature: matureDue, total: young + matureDue });
  }

  // ---- personal records ---------------------------------------------------
  const bestDay = days.reduce((a, d) => (d.total > a.total ? d : a), days[0]);
  const bestTimeDay = days.reduce((a, d) => (d.timeSec > a.timeSec ? d : a), days[0]);
  // longest streak ever
  let longest = 0, run = 0;
  days.forEach((d) => { if (d.studied) { run++; longest = Math.max(longest, run); } else run = 0; });
  const lifetimeCards = sumDays(days, "total");
  const lifetimeTime = sumDays(days, "timeSec");
  const lifetimeRetention = avgRetention(days);

  const records = [
    { label: "Best day", value: bestDay.total.toLocaleString(), unit: "cards", sub: fmtDate(bestDay.date) },
    { label: "Longest streak", value: longest.toLocaleString(), unit: "days", sub: "all-time" },
    { label: "Most time / day", value: fmtDur(bestTimeDay.timeSec), unit: "", sub: fmtDate(bestTimeDay.date) },
    { label: "Lifetime cards", value: compact(lifetimeCards), unit: "reviews", sub: "since " + fmtDate(start) },
    { label: "Lifetime focus", value: Math.round(lifetimeTime / 3600).toLocaleString(), unit: "hours", sub: "total study" },
    { label: "True retention", value: Math.round(lifetimeRetention * 100) + "%", unit: "", sub: "all-time avg" },
  ];

  // ---- FSRS-ish memory stats ---------------------------------------------
  const matureCount = mature;
  const youngCount = Math.round(matureCount * 0.46);
  const fsrs = {
    stability: 64, // avg days
    difficulty: 0.31, // 0..1 (lower easier)
    retrievability: 0.91,
    mature: matureCount,
    young: youngCount,
    // retrievability distribution buckets
    retr: [
      { band: "<70%", n: 420 },
      { band: "70–80%", n: 690 },
      { band: "80–90%", n: 2050 },
      { band: "90–95%", n: 3120 },
      { band: ">95%", n: 2480 },
    ],
  };

  // ---- achievements -------------------------------------------------------
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

  // ---- deck leaderboard (current period filled in by app) ----------------
  function deckBoard(range) {
    const p = period(range, "total");
    const rows = DECKS.map((d) => ({
      name: d.name, color: d.color, retain: d.retain,
      cards: sumDays(p.list, null) && 0, // placeholder
    }));
    // sum per deck across period list
    rows.forEach((r) => {
      r.cards = p.list.reduce((a, day) => a + (day.deckSplit[r.name] || 0), 0);
      r.time = Math.round(r.cards * 9);
    });
    rows.sort((a, b) => b.cards - a.cards);
    return rows;
  }

  // ---- goals --------------------------------------------------------------
  function goals(range) {
    const p = period(range, "total");
    const mult = range === "week" ? 1 : range === "month" ? 4.3 : 52;
    return [
      { key: "cards", label: "Cards", value: p.cards, target: Math.round(1200 * mult), unit: "", icon: "layers", rate: "1,200/week" },
      { key: "time", label: "Study Time", value: p.time, target: Math.round(7 * 3600 * mult), unit: "time", icon: "clock", rate: "7h/week" },
      { key: "new", label: "New Cards", value: p.newC, target: Math.round(120 * mult), unit: "", icon: "plus", rate: "120/week" },
      { key: "days", label: "Days Studied", value: p.daysStudied, target: range === "week" ? 7 : range === "month" ? 30 : 365, unit: "", icon: "check", rate: "7/week" },
    ];
  }

  // ---- formatting ---------------------------------------------------------
  function fmtDur(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    if (h <= 0) return m + "m";
    return h + "h " + (m < 10 ? "0" + m : m) + "m";
  }
  function fmtDurShort(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    if (h <= 0) return m + "m";
    return h + "h " + m + "m";
  }
  function compact(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return "" + n;
  }
  function fmtDate(d) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }

  window.ANKI = {
    TODAY, days, DECKS, METRICS, hourly, forecast, records, fsrs, achievements,
    streakDays, totalSessions, matureCount, lifetimeCards,
    trend, period, deckBoard, goals,
    startOfWeek,
    fmt: { fmtDur, fmtDurShort, compact, fmtDate },
  };
})();
