/**
 * Rasterizes public/icons/icon.svg into the PNG sizes the manifest and iOS
 * need. Run manually after editing the SVG:
 *
 *   node scripts/generate-icons.mjs
 *
 * Not part of `npm run build` — the icons change about once a year, and a
 * build step that shells out to a browser would be a poor trade for that.
 *
 * Two of the outputs get a solid white plate composited underneath, because
 * transparency is not an option there: iOS renders a transparent
 * apple-touch-icon over black, and an Android maskable icon is cropped to a
 * platform shape and must be full-bleed. The rest stay transparent.
 *
 * Uses headless Chrome/Edge because there is no rasterizer installed and the
 * artwork has bezier paths. Every output is verified for dimensions and for a
 * complete PNG stream before it is written into public/.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BROWSERS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  throw new Error(
    `No Chrome or Edge found. Looked in:\n  ${BROWSERS.join("\n  ")}`
  );
}

const svg = readFileSync("public/icons/icon.svg", "utf8");

const work = join(tmpdir(), "multilingo-icons");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

/**
 * `inset` shrinks the artwork inside the canvas. Only the maskable icon needs
 * it: Android crops that one to a platform shape, and the guaranteed-visible
 * region is a *circle* of 80% diameter — not a square. The tail feathers reach
 * about 84 units from centre in a 192 box, against a safe radius of 76.8, so
 * at full bleed the tip gets shaved off a circular mask. Scaling the artwork
 * to 80% puts everything inside that circle. iOS is not cropped this way (it
 * applies a mild squircle), so apple-touch-icon stays full size — insetting it
 * would just make the icon look small next to every other app.
 */
const shim = (size, plate, inset = 1) => `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;overflow:hidden;background:${plate ?? "transparent"}}
  body{width:${size}px;height:${size}px;display:grid;place-items:center}
  svg{display:block;width:${Math.round(size * inset)}px;height:${Math.round(size * inset)}px}
</style>
${svg}`;

const targets = [
  // Manifest "any" icons and the browser tab: transparent.
  { size: 192, plate: null, out: "public/icons/icon-192.png" },
  { size: 512, plate: null, out: "public/icons/icon-512.png" },
  // Must be opaque. White plate, per the brand decision.
  { size: 512, plate: "#FFFFFF", inset: 0.8, out: "public/icons/icon-maskable-512.png" },
  { size: 180, plate: "#FFFFFF", out: "public/icons/apple-touch-icon.png" },
];

for (const { size, plate, inset, out } of targets) {
  const slug = `${size}-${plate ? "plate" : "clear"}-${inset ?? 1}`;
  const html = join(work, `${slug}.html`);
  const png = join(work, `${slug}.png`);
  writeFileSync(html, shim(size, plate, inset));

  execFileSync(
    browser,
    [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      // Without this the headless default is an opaque white page, which
      // would silently defeat the transparent variants.
      "--default-background-color=00000000",
      `--screenshot=${png}`,
      `--window-size=${size},${size}`,
      "--force-device-scale-factor=1",
      html,
    ],
    { stdio: "ignore" }
  );

  const buf = readFileSync(png);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);

  // Walk the chunk list; a complete stream lands exactly on IEND at EOF.
  // An earlier attempt at moving these files around produced truncated PNGs
  // that still had a valid header, so header-only checks are not enough.
  let off = 8;
  let last = "";
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    last = buf.toString("ascii", off + 4, off + 8);
    off += 12 + len;
  }
  const complete = last === "IEND" && off === buf.length;

  if (w !== size || h !== size || !complete) {
    throw new Error(
      `${out}: expected ${size}x${size} and a complete stream, got ${w}x${h}, last chunk ${last}`
    );
  }

  writeFileSync(out, buf);
  console.log(`${out.padEnd(38)} ${w}x${h}  ${String(buf.length).padStart(6)} bytes  ${plate ? "white plate" : "transparent"}`);
}

rmSync(work, { recursive: true, force: true });
