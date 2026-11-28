// Local preview of the static website, serving pages the way Cloudflare does: /courses → public/courses/index.html.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "public");
const port = Number(process.env.PORT || process.argv[2] || 4321);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".woff2": "font/woff2", ".svg": "image/svg+xml" };

async function file(p) {
  try { return (await stat(p)).isFile() ? p : null; } catch { return null; }
}

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const base = join(root, path);
  if (!base.startsWith(root)) { res.writeHead(403).end(); return; }
  const hit = (await file(base)) ?? (await file(join(base, "index.html"))) ?? (await file(base + ".html"));
  const target = hit ?? join(root, "404.html");
  res.writeHead(hit ? 200 : 404, { "content-type": TYPES[extname(target)] ?? "application/octet-stream" });
  res.end(await readFile(target));
}).listen(port, "127.0.0.1", () => console.log(`Website preview on http://127.0.0.1:${port}`));
