/**
 * Writes the README banner and the GitHub social preview, after the
 * "Port banner A · centered lockup" board of the mistpine logos canvas:
 * the mark and `mistpine.ghostty` centered on the editor background, over a
 * band of the accents.
 *
 *   pnpm banner
 *
 * Text is outlined with HarfBuzz (scripts/lib/text.ts), so the SVGs need no
 * fonts. The PNG is drawn by Chromium (CHROMIUM overrides playwright's).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { loadSpec, ROOT } from "./lib/colors.ts";
import { num, shape, type TextStyle, textPath } from "./lib/text.ts";

const { spec } = await loadSpec();
const p = spec.palette;
const ansi = spec.ansi.map((t) => t.hex);
const c = (key: string) => {
  const v = p[key];
  if (!v) throw new Error(`palette has no ${key}`);
  return v;
};

const [W, H, BAND] = [1280, 640, 10];
const MARK = 180;
const GAP = 36;
const WORD: TextStyle = { family: "outfit", size: 104, weight: 300, tracking: -0.03 };
const SUFFIX: TextStyle = { family: "mono", size: 80, weight: 300, tracking: -0.02 };
/** The suffix color for mistpine.ghostty (docs/brand.md in mistpine/mistpine). */
const ACCENT = c("brightBlue");

/** The mark (120 × 120 units): three pines with fog between them. */
function mark(x: number, y: number, size: number): string {
  const wave = "q7 -5 14 0 t14 0 t14 0 t14 0 t14 0";
  const fog = (d: string, color: string) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="4.5" stroke-linecap="round"/>`;
  const pine = (d: string, color: string) => `<path d="${d}" fill="${color}"/>`;
  return `<g transform="translate(${num(x)} ${num(y)}) scale(${num(size / 120)})">${[
    pine("M60 8 L84 76 L36 76 Z", c("fg0")),
    fog(`M34 64 ${wave}`, c("bg4")),
    pine("M80 30 L104 98 L56 98 Z", c("fg1")),
    fog(`M44 86 ${wave}`, c("fg2")),
    pine("M38 38 L64 110 L12 110 Z", c("brightCyan")),
    fog(`M4 98 ${wave}`, c("fg3")),
  ].join("")}</g>`;
}

function banner(rounded: boolean): string {
  const word = shape("mistpine", WORD);
  const suffix = shape(".ghostty", SUFFIX);
  // CSS letter spacing also follows the last letter of each run.
  const wordAdvance = word.width + (WORD.tracking ?? 0) * WORD.size;
  const textW = wordAdvance + suffix.width + (SUFFIX.tracking ?? 0) * SUFFIX.size;
  const x0 = (W - (MARK + GAP + textW)) / 2;
  const cy = (H - BAND) / 2;
  // Center the line box both runs share, as flexbox does.
  const ascent = Math.max(word.ascent, suffix.ascent);
  const descent = Math.max(word.descent, suffix.descent);
  const baseline = cy - (ascent + descent) / 2 + ascent;
  const tx = x0 + MARK + GAP;

  const accents = ["red", "orange", "yellow", "green", "cyan", "blue", "purple"].map(c);
  const band = [...accents, ansi[5] as string, c("pink")];
  const segment = W / band.length;
  const stripes = band
    .map(
      (color, i) =>
        `<rect x="${num(i * segment)}" y="${H - BAND}" width="${num(segment + 0.5)}" height="${BAND}" fill="${color}"/>`,
    )
    .join("");

  const label = "mistpine.ghostty: the mistpine color scheme for Ghostty";
  const card = `<rect width="${W}" height="${H}" fill="${c("bg1")}"/>${stripes}`;
  const body = [
    rounded
      ? `<defs><clipPath id="card"><rect width="${W}" height="${H}" rx="24"/></clipPath></defs><g clip-path="url(#card)">${card}</g>`
      : card,
    mark(x0, cy - MARK / 2, MARK),
    textPath("mistpine", WORD, tx, baseline, c("fg3")),
    textPath(".ghostty", SUFFIX, tx + wordAdvance, baseline, ACCENT),
  ].join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}"><title>${label}</title>${body}</svg>\n`;
}

const assets = join(ROOT, "assets");
writeFileSync(join(assets, "banner.svg"), banner(true));
writeFileSync(join(assets, "social-preview.svg"), banner(false));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto(pathToFileURL(join(assets, "social-preview.svg")).href);
  await page.screenshot({ path: join(assets, "social-preview.png") });
} finally {
  await browser.close();
}
console.log("wrote assets/banner.svg, assets/social-preview.svg, assets/social-preview.png");
