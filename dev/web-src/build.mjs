// Build the Recall web layer with esbuild.
//   node build.mjs           -> one-shot production build into ../../recall/web
//   node build.mjs --watch   -> rebuild on change
//   node build.mjs --serve   -> also serve ../../recall/web at http://localhost:8123
//
// We precompile JSX + bundle React (and the stylesheet, as text) so the shipped
// add-on is a single recall.js — no CDN, no Babel, no separate CSS file.
import * as esbuild from "esbuild";

const OUT_DIR = "../../recall/web";
const watch = process.argv.includes("--watch");
const serve = process.argv.includes("--serve");

const options = {
  entryPoints: ["src/main.jsx"],
  bundle: true,
  format: "iife",
  outfile: `${OUT_DIR}/recall.js`,
  jsx: "automatic",
  loader: { ".js": "jsx", ".jsx": "jsx", ".css": "text" },
  target: ["chrome108"], // Anki 25.09 ships a modern Chromium via QtWebEngine
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  legalComments: "none",
  logLevel: "info",
};

if (watch || serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  if (serve) {
    const { host, port } = await ctx.serve({ servedir: OUT_DIR, port: 8123 });
    console.log(`[recall] dev server: http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
  } else {
    console.log("[recall] watching for changes…");
  }
} else {
  await esbuild.build(options);
  console.log(`[recall] built -> ${OUT_DIR}/recall.js`);
}
