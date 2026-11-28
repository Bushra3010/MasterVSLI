// Builds the fast, deployable website: src/ → dist/.
//   node website/build.mjs        (uses `sharp` from web/node_modules for images)
// - styles are inlined into every page (no render-blocking stylesheet request)
// - the main font is preloaded; YouTube thumbnail host is pre-connected on video pages
// - logo and posters are served as resized WebP; full-size JPEGs stay for "open full size" links
// - asset URLs carry a content hash (?v=…) so browsers can cache them for a year (see _headers)
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "src");
const DIST = join(HERE, "dist");
const sharp = createRequire(join(HERE, "../web/package.json"))("sharp");

const hash = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

await rm(DIST, { recursive: true, force: true });
await cp(SRC, DIST, { recursive: true });

// ---- images ---------------------------------------------------------------------------------
const version = {}; // public path → ?v=hash
const kb = (n) => `${Math.round(n / 1024)} KB`;

// Logo: shown 45–46 px tall → 2× density WebP and PNG fallback.
const logoSrc = await readFile(join(SRC, "assets/logo-official.png"));
const logoWebp = await sharp(logoSrc).resize({ height: 96 }).webp({ quality: 90, alphaQuality: 90 }).toBuffer();
await writeFile(join(DIST, "assets/logo-official.webp"), logoWebp);
version["/assets/logo-official.webp"] = hash(logoWebp);
console.log(`logo  ${kb(logoSrc.length)} → ${kb(logoWebp.length)} (webp)`);

// Posters: WebP for the page, recompressed JPEG for the full-size link.
for (const f of (await readdir(join(SRC, "media"))).filter((f) => f.endsWith(".jpg"))) {
  const input = await readFile(join(SRC, "media", f));
  const webp = await sharp(input).resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
  const jpg = await sharp(input).resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  const base = f.replace(/\.jpg$/, "");
  await writeFile(join(DIST, "media", `${base}.webp`), webp);
  await writeFile(join(DIST, "media", f), jpg.length < input.length ? jpg : input);
  version[`/media/${base}.webp`] = hash(webp);
  version[`/media/${f}`] = hash(jpg.length < input.length ? jpg : input);
  console.log(`${f.padEnd(24)} ${kb(input.length)} → ${kb(webp.length)} webp, ${kb(Math.min(jpg.length, input.length))} jpg`);
}

// ---- styles & scripts -----------------------------------------------------------------------
const css = (await readFile(join(SRC, "assets/site.css"), "utf8")) + "\n" + (await readFile(join(SRC, "assets/extra.css"), "utf8"));
const js = await readFile(join(SRC, "assets/site.js"));
version["/assets/site.js"] = hash(js);
for (const f of ["assets/logo-mark.png", "favicon.ico"]) version["/" + f] = hash(await readFile(join(SRC, f)));
const FONT = "/assets/media/71f22fac18a27e7e-s.p.1mga1wukbs0k4.woff2"; // basic Latin subset: needed on every page

// ---- pages ----------------------------------------------------------------------------------
const v = (p) => (version[p] ? `${p}?v=${version[p]}` : p);
let pages = 0;
for (const file of (await walk(DIST)).filter((p) => p.endsWith(".html"))) {
  let html = await readFile(file, "utf8");
  const head = [
    `<link rel="preload" href="${FONT}" as="font" type="font/woff2" crossorigin=""/>`,
    html.includes("i.ytimg.com") ? '<link rel="preconnect" href="https://i.ytimg.com"/>' : "",
  ].join("");
  html = html.replace(
    '<link rel="stylesheet" href="/assets/site.css"/><link rel="stylesheet" href="/assets/extra.css"/>',
    () => `${head}<style>${css}</style>`,
  );
  if (!html.includes("<style>")) throw new Error(`${relative(DIST, file)}: stylesheet links not found`);
  html = html
    .replaceAll('src="/assets/logo-official.png"', `src="${v("/assets/logo-official.webp")}" decoding="async"`)
    .replace(/src="\/media\/([\w-]+)\.jpg"/g, (_, b) => `src="${v(`/media/${b}.webp`)}" decoding="async"`)
    .replace(/href="\/media\/([\w-]+\.jpg)"/g, (_, f) => `href="${v(`/media/${f}`)}"`)
    .replaceAll('src="/assets/site.js"', `src="${v("/assets/site.js")}"`)
    .replaceAll('href="/assets/logo-mark.png"', `href="${v("/assets/logo-mark.png")}"`)
    .replace(/(<img src="https:\/\/i\.ytimg\.com[^"]*")/g, '$1 decoding="async"');
  await writeFile(file, html);
  pages++;
}

// The originals are not needed once inlined / converted.
for (const f of ["assets/site.css", "assets/extra.css", "assets/logo-official.png"]) await rm(join(DIST, f));

// ---- caching --------------------------------------------------------------------------------
await writeFile(
  join(DIST, "_headers"),
  [
    "# Versioned files (?v=hash) and hashed fonts never change: cache for a year.",
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "/media/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "/favicon.ico",
    "  Cache-Control: public, max-age=604800",
    "",
  ].join("\n"),
);

const size = (await Promise.all((await walk(DIST)).map(async (p) => (await stat(p)).size))).reduce((a, b) => a + b, 0);
console.log(`\n${pages} pages built → dist/ (${kb(size)} total, ${extname(FONT)} preloaded)`);
