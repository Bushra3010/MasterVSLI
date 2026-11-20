// Works around an @opennextjs/aws bug: it does `import cookieParser from "cookie"`, but cookie@1.x
// has no default export, so every request carrying a Cookie header (any signed-in user) crashes the
// Worker with "Cannot read properties of undefined (reading 'parse')" (Cloudflare error 1101).
// Runs on postinstall; safe to run repeatedly. Remove once OpenNext ships a fix.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const files = [
  "node_modules/@opennextjs/aws/dist/overrides/converters/edge.js",
  "node_modules/@opennextjs/aws/dist/overrides/converters/node.js",
];
const BAD = 'import cookieParser from "cookie";';
const GOOD = 'import * as cookieParser from "cookie";';

for (const f of files) {
  if (!existsSync(f)) continue;
  const src = readFileSync(f, "utf8");
  if (src.includes(BAD)) {
    writeFileSync(f, src.replace(BAD, GOOD));
    console.log(`patched ${f}`);
  }
}
