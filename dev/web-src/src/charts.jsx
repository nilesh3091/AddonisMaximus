/* Chart primitives: Ring, TrendChart (area/line/bar + hover), Bars. */
import React from "react";

// measure container width (crisp text, responsive)
export function useMeasure() {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => setW(es[0].contentRect.width));
    ro.observe(ref.current);
    setW(ref.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// Measure both width AND height — lets a chart fill a flex parent's box so a card
// occupies the same stable height whether or not it owns a tall chart (carousel).
export function useBox() {
  const ref = React.useRef(null);
  const [box, setBox] = React.useState({ w: 0, h: 0 });
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => {
      const r = es[0].contentRect; setBox({ w: r.width, h: r.height });
    });
    ro.observe(ref.current);
    const r = ref.current.getBoundingClientRect();
    setBox({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, []);
  return [ref, box.w, box.h];
}

// ---- circular progress ring -------------------------------------------
export function Ring({ value, max, size = 96, stroke = 9, color = "var(--accent)", children, delay = 0 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  // Initialise at the final value so the ring is correct on first paint, then
  // animate when `value` changes (range toggle).
  const [draw, setDraw] = React.useState(pct);
  React.useEffect(() => {
    const id = setTimeout(() => setDraw(pct), 30 + delay);
    return () => clearTimeout(id);
  }, [pct, delay]);
  const over = value >= max && max > 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c * (1 - draw)}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)", filter: over ? "drop-shadow(0 0 6px var(--glow))" : "none" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{children}</div>
    </div>
  );
}

// ---- x-axis month/year labels from Date buckets -----------------------
function axisLabels(data, range) {
  const out = [];
  if (range === "year") {
    data.forEach((d, i) => out.push({ i, text: d.label.getUTCFullYear() }));
    return out;
  }
  let prevMo = -1;
  data.forEach((d, i) => {
    const mo = d.label.getUTCMonth();
    if (range === "month") {
      out.push({ i, text: d.label.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase() });
    } else {
      if (mo !== prevMo) {
        out.push({ i, text: d.label.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase() });
        prevMo = mo;
      }
    }
  });
  return out;
}

// ---- main trend chart --------------------------------------------------
export function TrendChart({ data, height: heightProp = 190, fill = false, type = "area", range = "week", valueFmt = (v) => v, accent = "var(--accent)" }) {
  const [ref, w, boxH] = useBox();
  const height = fill && boxH > 24 ? boxH : heightProp;
  const [hover, setHover] = React.useState(null);
  const padL = 6, padR = 46, padT = 16, padB = 26;
  const W = Math.max(w, 60);
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = niceCeil(max);
  const n = data.length;
  const x = (i) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const xBar = (i) => padL + (i + 0.5) * (innerW / n);
  const y = (v) => padT + innerH * (1 - v / niceMax);
  const labels = axisLabels(data, range);

  const linePts = data.map((d, i) => [x(i), y(d.value)]);
  const linePath = linePts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const areaPath = linePath + ` L ${x(n - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const gridVals = [0, niceMax / 2, niceMax];

  // Hover hit-testing: instead of mapping the pointer into SVG units by hand
  // (which breaks under the carousel's CSS `zoom`, where MouseEvent.clientX and
  // getBoundingClientRect live in inconsistent coordinate spaces), we tile the
  // plot with one transparent rect per point and let the browser hit-test. The
  // band for point i spans the midpoints to its neighbours, so hovering always
  // selects the nearest point — and it's immune to zoom/transforms.
  const cx = (i) => (type === "bar" ? xBar(i) : x(i));
  const bandL = (i) => (i === 0 ? 0 : (cx(i - 1) + cx(i)) / 2);
  const bandR = (i) => (i === n - 1 ? W : (cx(i) + cx(i + 1)) / 2);

  return (
    <div ref={ref} style={{ width: "100%", height: fill ? "100%" : undefined, position: "relative" }}>
      {w > 0 && (
        <svg width={W} height={height} onMouseLeave={() => setHover(null)} style={{ display: "block", cursor: "crosshair" }}>
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {gridVals.map((gv, k) => (
            <g key={k}>
              <line x1={padL} x2={padL + innerW} y1={y(gv)} y2={y(gv)} stroke="var(--line)" strokeWidth="1" />
              <text x={W - padR + 8} y={y(gv) + 4} className="tick" style={{ fontSize: 11 }}>{valueFmt(gv)}</text>
            </g>
          ))}
          {type === "bar" ? (
            data.map((d, i) => {
              const bw = Math.min(28, (innerW / n) * 0.62);
              const bh = innerH * (d.value / niceMax);
              const active = hover === i;
              return (
                <rect key={i} x={xBar(i) - bw / 2} y={padT + innerH - bh} width={bw} height={Math.max(0, bh)}
                  rx="3" fill={accent} opacity={hover == null || active ? 1 : 0.45}
                  style={{ transition: "opacity .12s" }} />
              );
            })
          ) : (
            <>
              <path d={areaPath} fill="url(#areaFill)" />
              <path d={linePath} fill="none" stroke={accent} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
              {data.map((d, i) => {
                const active = hover === i;
                return (
                  <g key={i}>
                    {active && <circle cx={x(i)} cy={y(d.value)} r={11} fill={accent} opacity={0.25} />}
                    <circle cx={x(i)} cy={y(d.value)} r={active ? 5.5 : 4.5}
                      fill={active ? accent : "var(--card)"} stroke={accent} strokeWidth="2.5" />
                  </g>
                );
              })}
            </>
          )}
          {hover != null && (
            <line x1={type === "bar" ? xBar(hover) : x(hover)} x2={type === "bar" ? xBar(hover) : x(hover)}
              y1={padT} y2={padT + innerH} stroke="var(--text2)" strokeWidth={type === "bar" ? 1 : 1.5} opacity={type === "bar" ? 1 : 0.8} strokeDasharray={type === "bar" ? "3 3" : "none"} />
          )}
          {labels.map((l, k) => {
            const lx = type === "bar" ? xBar(l.i) : x(l.i);
            const anchor = l.i === 0 ? "start" : l.i === n - 1 ? "end" : "middle";
            return <text key={k} x={lx} y={height - 7} textAnchor={anchor} className="tick" style={{ fontSize: 11 }}>{l.text}</text>;
          })}
          {/* Transparent per-point hit bands (topmost) — native hit-testing, zoom-safe. */}
          {data.map((d, i) => (
            <rect key={"hit" + i} x={bandL(i)} y={0} width={Math.max(0, bandR(i) - bandL(i))} height={height}
              fill="transparent" style={{ pointerEvents: "all" }}
              onMouseEnter={() => setHover(i)} onMouseMove={() => setHover(i)} />
          ))}
        </svg>
      )}
      {hover != null && data[hover] && (
        <Tooltip x={(type === "bar" ? xBar(hover) : x(hover))} W={W}
          title={bucketTitle(data[hover].label, range)} value={valueFmt(data[hover].value)} />
      )}
    </div>
  );
}

function Tooltip({ x, W, title, value }) {
  const left = Math.max(8, Math.min(W - 130, x - 60));
  return (
    <div className="fade" style={{
      position: "absolute", top: 0, left, width: 120, pointerEvents: "none",
      background: "var(--card2)", border: "1px solid var(--border)", borderRadius: 9,
      padding: "7px 10px", boxShadow: "0 8px 24px rgba(0,0,0,.35)", zIndex: 5,
    }}>
      <div style={{ fontSize: 10.5, color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>{title}</div>
      <div className="num" style={{ fontSize: 18, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function bucketTitle(date, range) {
  if (range === "day") return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  if (range === "month") return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  // Week: show the full span (e.g. "Apr 13 – 19" or "Apr 27 – May 3") so it's
  // unambiguous which week the point covers.
  const opt = { month: "short", day: "numeric", timeZone: "UTC" };
  const end = new Date(date.getTime() + 6 * 86400000);
  const startTxt = date.toLocaleDateString("en-US", opt);
  const endTxt = date.getUTCMonth() === end.getUTCMonth()
    ? end.getUTCDate()
    : end.toLocaleDateString("en-US", opt);
  return startTxt + " – " + endTxt;
}

export function niceCeil(v) {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / mag;
  // Finer ladder so the axis hugs the data. The old {1,2,2.5,5,10} set left a
  // big gap after 2.5 — a 2.6k peak jumped to a 5k ceiling, flattening the plot.
  const nice = f <= 1 ? 1 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 2.5 ? 2.5
             : f <= 3 ? 3 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 6 ? 6 : f <= 8 ? 8 : 10;
  return nice * mag;
}

// ---- generic vertical bars (stacked optional) -------------------------
export function Bars({ data, height: heightProp = 150, fill = false, segments = null, colors = ["var(--accent)"], valueFmt = (v) => v, labelEvery = 5, axis = true }) {
  const [ref, w, boxH] = useBox();
  const height = fill && boxH > 24 ? boxH : heightProp;
  const [hover, setHover] = React.useState(null);
  const padL = 4, padR = axis ? 40 : 6, padT = 12, padB = 22;
  const W = Math.max(w, 60);
  const innerW = W - padL - padR, innerH = height - padT - padB;
  const totals = data.map((d) => (segments ? segments.reduce((a, s) => a + d[s], 0) : d.value));
  const niceMax = niceCeil(Math.max(1, ...totals));
  const n = data.length;
  const xb = (i) => padL + (i + 0.5) * (innerW / n);
  const bw = Math.min(26, (innerW / n) * 0.66);
  const gridVals = axis ? [0, niceMax / 2, niceMax] : [];
  return (
    <div ref={ref} style={{ width: "100%", height: fill ? "100%" : undefined, position: "relative" }}>
      {w > 0 && (
        <svg width={W} height={height} onMouseLeave={() => setHover(null)} style={{ display: "block" }}>
          {gridVals.map((gv, k) => (
            <g key={k}>
              <line x1={padL} x2={padL + innerW} y1={padT + innerH * (1 - gv / niceMax)} y2={padT + innerH * (1 - gv / niceMax)} stroke="var(--line)" />
              <text x={W - padR + 7} y={padT + innerH * (1 - gv / niceMax) + 4} className="tick" style={{ fontSize: 10.5 }}>{valueFmt(gv)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            let acc = 0;
            const parts = segments || ["value"];
            const active = hover === i;
            return (
              <g key={i} onMouseEnter={() => setHover(i)}>
                <rect x={xb(i) - bw / 2 - 2} y={padT} width={bw + 4} height={innerH} fill="transparent" />
                {parts.map((s, si) => {
                  const v = d[s];
                  const h = innerH * (v / niceMax);
                  const yy = padT + innerH - acc - h;
                  acc += h;
                  return <rect key={si} x={xb(i) - bw / 2} y={yy} width={bw} height={Math.max(0, h)} rx="2.5"
                    fill={colors[si % colors.length]} opacity={hover == null || active ? 1 : 0.4} style={{ transition: "opacity .12s" }} />;
                })}
                {i % labelEvery === 0 && <text x={xb(i)} y={height - 6} textAnchor="middle" className="tick" style={{ fontSize: 10.5 }}>{d.x}</text>}
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && data[hover] && (
        <Tooltip x={xb(hover)} W={W} title={data[hover].tip || data[hover].x}
          value={valueFmt(totals[hover])} />
      )}
    </div>
  );
}

// ---- mini inline trends (Apple-Health style) --------------------------
// Tiny fixed-height charts that sit under a headline number: no axis, no
// labels, no hover — just the shape of the last N buckets with the most recent
// one accented. Both measure their own pixel width (like MaturityCard's bar) so
// the carousel's CSS `zoom` can't mis-size them in Anki's webview.
export const SPARK_MUTED = "color-mix(in oklab, var(--text3) 62%, var(--card2))";

// Bars — for counts (cards, reviews, time). Normalised to the series max. `hi`
// picks which bar gets the accent colour (default the last = most recent; the
// month cards pass the busiest day instead).
export function Sparkbars({ values, height = 30, color = "var(--accent)", muted = SPARK_MUTED, hi }) {
  const [ref, w] = useMeasure();
  const vals = values || [];
  const n = vals.length;
  const W = Math.max(w, 40);
  const max = Math.max(1, ...vals);
  const bw = n > 0 ? Math.min(11, (W / n) * 0.62) : 4;
  const hiIdx = hi == null ? n - 1 : hi;
  return (
    <div ref={ref} style={{ width: "100%" }}>
      {w > 0 && n > 0 && (
        <svg width={W} height={height} style={{ display: "block", overflow: "visible" }} aria-hidden="true">
          {vals.map((v, i) => {
            const h = Math.max(1.5, (v / max) * (height - 2));
            const cx = (i + 0.5) * (W / n);
            return <rect key={i} x={cx - bw / 2} y={height - h} width={bw} height={h} rx="1.5"
              fill={i === hiIdx ? color : muted} />;
          })}
        </svg>
      )}
    </div>
  );
}

// Line — for rates (retention). Min–max autoscaled so small swings still read.
export function Sparkline({ values, height = 30, color = "var(--accent)", muted = SPARK_MUTED }) {
  const [ref, w] = useMeasure();
  const vals = values || [];
  const n = vals.length;
  const W = Math.max(w, 40);
  const pad = 4;
  const mn = n ? Math.min(...vals) : 0;
  const mx = n ? Math.max(...vals) : 1;
  const rng = mx - mn || 1;
  const x = (i) => (n <= 1 ? W / 2 : pad + (i / (n - 1)) * (W - 2 * pad));
  const y = (v) => (height - pad) - ((v - mn) / rng) * (height - 2 * pad);
  const d = vals.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  return (
    <div ref={ref} style={{ width: "100%" }}>
      {w > 0 && n > 0 && (
        <svg width={W} height={height} style={{ display: "block", overflow: "visible" }} aria-hidden="true">
          {n > 1 && <path d={d} fill="none" stroke={muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
          <circle cx={x(n - 1)} cy={y(vals[n - 1])} r="3" fill={color} />
        </svg>
      )}
    </div>
  );
}
