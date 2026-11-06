/**
 * The mistpine spec and the color math the theme needs.
 *
 * The spec is `palette/mistpine.json` from the reference repository, read from
 * $MISTPINE_DIR, then ../mistpine, then GitHub.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dirname, "..", "..");
export const SPEC_URL =
  "https://raw.githubusercontent.com/mistpine/mistpine/main/palette/mistpine.json";

export interface Token {
  hex: string;
  ref?: string;
  derived?: string;
  italic?: boolean;
  bold?: boolean;
  underline?: boolean;
}

export interface Spec {
  name: string;
  variant: string;
  palette: Record<string, string>;
  terminal: Record<string, Token>;
  ansi: Token[];
  syntax: Record<string, Token>;
  ui: Record<string, Token>;
}

/** Reads the spec; `source` says where it came from. */
export async function loadSpec(): Promise<{ spec: Spec; source: string }> {
  const dir = process.env.MISTPINE_DIR ?? join(ROOT, "..", "mistpine");
  const file = join(dir, "palette", "mistpine.json");
  if (existsSync(file)) {
    return { spec: JSON.parse(readFileSync(file, "utf8")) as Spec, source: file };
  }
  const res = await fetch(SPEC_URL);
  if (!res.ok) throw new Error(`could not download ${SPEC_URL}: HTTP ${res.status}`);
  return { spec: (await res.json()) as Spec, source: SPEC_URL };
}

/** `#rrggbb` to 0..1 channels. */
export function rgb(hex: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`not a #rrggbb color: ${hex}`);
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function hex(r: number, g: number, b: number): string {
  const byte = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `#${[r, g, b].map((v) => byte(v).toString(16).padStart(2, "0")).join("")}`;
}

const toLinear = (c: number) =>
  Math.abs(c) <= 0.04045 ? c / 12.92 : Math.sign(c) * ((Math.abs(c) + 0.055) / 1.055) ** 2.4;
const fromLinear = (c: number) =>
  Math.abs(c) > 0.0031308 ? Math.sign(c) * (1.055 * Math.abs(c) ** (1 / 2.4) - 0.055) : c * 12.92;

// OKLab with culori's constants, so blends match themes.utimura.io and mistpine.nvim.
function toOklab(color: string): [number, number, number] {
  const [r, g, b] = rgb(color).map(toLinear) as [number, number, number];
  const l = Math.cbrt(0.412221469470763 * r + 0.5363325372617348 * g + 0.0514459932675022 * b);
  const m = Math.cbrt(0.2119034958178252 * r + 0.6806995506452344 * g + 0.1073969535369406 * b);
  const s = Math.cbrt(0.0883024591900564 * r + 0.2817188391361215 * g + 0.6299787016738222 * b);
  return [
    0.210454268309314 * l + 0.7936177747023054 * m - 0.0040720430116193 * s,
    1.9779985324311684 * l - 2.4285922420485799 * m + 0.450593709617411 * s,
    0.0259040424655478 * l + 0.7827717124575296 * m - 0.8086757549230774 * s,
  ];
}

function fromOklab(L: number, a: number, b: number): string {
  const l = (L + 0.3963377773761749 * a + 0.2158037573099136 * b) ** 3;
  const m = (L - 0.1055613458156586 * a - 0.0638541728258133 * b) ** 3;
  const s = (L - 0.0894841775298119 * a - 1.2914855480194092 * b) ** 3;
  return hex(
    fromLinear(4.0767416360759574 * l - 3.3077115392580616 * m + 0.2309699031821044 * s),
    fromLinear(-1.2684379732850317 * l + 2.6097573492876887 * m - 0.3413193760026573 * s),
    fromLinear(-0.0041960761386756 * l - 0.7034186179359362 * m + 1.7076146940746117 * s),
  );
}

/** The spec's `mix(base, color, amount)`: OKLab, `amount` 0..1. */
export function mix(base: string, color: string, amount: number): string {
  const p = toOklab(base);
  const q = toOklab(color);
  const t = Math.max(0, Math.min(1, amount));
  return fromOklab(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
}

/** WCAG 2 contrast ratio, 1..21. */
export function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = rgb(c).map(toLinear) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** HSL with h in degrees and s, l in percent, rounded to one decimal. */
export function hsl(color: string): [number, number, number] {
  const [r, g, b] = rgb(color);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  const round = (v: number) => Math.round(v * 10) / 10;
  return [round(h), round(s * 100), round(l * 100)];
}
