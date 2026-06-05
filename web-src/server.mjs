// Minimal static server for previewing the built panel (../recall/web).
// Resolves its root by absolute path so it doesn't depend on cwd.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../recall/web");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

http
  .createServer(async (req, res) => {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/index.html";
    try {
      const fp = path.join(root, p);
      if (!fp.startsWith(root)) throw new Error("nope");
      const data = await readFile(fp);
      res.writeHead(200, { "content-type": TYPES[path.extname(fp)] || "application/octet-stream" });
      res.end(data);
    } catch (e) {
      res.writeHead(404);
      res.end("not found");
    }
  })
  .listen(process.env.PORT || 8123, "127.0.0.1", function () {
    console.log(`[recall] serving ${root} on http://127.0.0.1:${this.address().port}`);
  });
