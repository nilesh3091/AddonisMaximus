/* Entry point. Two mounts from one bundle:
   - window mode: full app in the page (light DOM, CSS in <head>).
   - embed mode:  carousel in a shadow root on Anki's home screen, so Addonis Maximus's
                  styles never leak into (or get clobbered by) Anki's page.
   The stylesheet is bundled as text and injected for whichever mount we use. */
import React from "react";
import { createRoot } from "react-dom/client";
import cssText from "./styles.css";
import { App } from "./app.jsx";
import { EmbeddedApp } from "./embed.jsx";
import { webBase, appMode } from "./config.js";

function injectFonts() {
  if (document.getElementById("addonismaximus-fonts")) return;
  const base = webBase();
  const s = document.createElement("style");
  s.id = "addonismaximus-fonts";
  s.textContent =
    `@font-face{font-family:"Archivo";src:url("${base}/fonts/Archivo.woff2") format("woff2");font-weight:100 900;font-display:swap;}` +
    `@font-face{font-family:"Hanken Grotesk";src:url("${base}/fonts/HankenGrotesk.woff2") format("woff2");font-weight:100 900;font-display:swap;}`;
  document.head.appendChild(s);
}

// Move our block to sit right below the Review Heatmap (it's appended last, so it
// otherwise lands at the very bottom). Falls back to just under "studied today".
function repositionEmbed(hostEl) {
  try {
    const heat = document.querySelector(".rh-container");
    if (heat && heat.parentNode && heat !== hostEl && !heat.contains(hostEl)) {
      heat.insertAdjacentElement("afterend", hostEl);
      return true;
    }
    const studied = document.getElementById("studiedToday");
    if (studied && studied.parentNode && !studied.contains(hostEl)) {
      studied.insertAdjacentElement("afterend", hostEl);
      return true;
    }
  } catch (_) {}
  return false;
}

function mountEmbed() {
  let hostEl = document.getElementById("addonismaximus-embed");
  if (!hostEl) {
    hostEl = document.createElement("div");
    hostEl.id = "addonismaximus-embed";
    document.body.appendChild(hostEl);
  }
  if (hostEl.shadowRoot) return;
  try {
    const shadow = hostEl.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = cssText;
    shadow.appendChild(style);
    const mountPoint = document.createElement("div");
    shadow.appendChild(mountPoint);
    createRoot(mountPoint).render(<EmbeddedApp host={hostEl} />);
    // Reposition now (DOM is parsed by the time this script runs) and once more
    // next frame, in case the heatmap block hasn't been laid out yet.
    repositionEmbed(hostEl);
    requestAnimationFrame(() => repositionEmbed(hostEl));
  } catch (e) {
    hostEl.textContent = "Addonis Maximus failed to load: " + (e && e.message ? e.message : e);
    hostEl.style.cssText = "color:#e8632a;font:13px sans-serif;padding:12px;";
  }
}

function mountWindow() {
  if (!document.getElementById("addonismaximus-css")) {
    const st = document.createElement("style");
    st.id = "addonismaximus-css";
    st.textContent = cssText;
    document.head.appendChild(st);
  }
  let el = document.getElementById("root");
  if (!el) {
    el = document.createElement("div");
    el.id = "root";
    document.body.appendChild(el);
  }
  createRoot(el).render(<App />);
}

injectFonts();
if (appMode() === "embed") mountEmbed();
else mountWindow();
