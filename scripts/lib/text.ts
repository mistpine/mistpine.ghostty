/**
 * Text as SVG paths: HarfBuzz shapes the string (kerning included) and the glyph
 * outlines become one `<path>`, so logos and specimens render the same everywhere,
 * with no font files to load.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as hb from "harfbuzzjs";
import { ROOT } from "./colors.ts";

export type Family = "outfit" | "mono";

const FILES: Record<Family, string> = {
  outfit: "Outfit-wght.ttf",
  mono: "JetBrainsMono-wght.ttf",
};

const faces = new Map<Family, hb.Face>();
function face(family: Family): hb.Face {
  let f = faces.get(family);
  if (!f) {
    const data = readFileSync(join(ROOT, "scripts", "fonts", FILES[family]));
    f = new hb.Face(new hb.Blob(new Uint8Array(data)));
    faces.set(family, f);
  }
  return f;
}

export interface TextStyle {
  family: Family;
  size: number;
  weight?: number;
  /** CSS-style letter spacing in em. */
  tracking?: number;
}

export interface Shaped {
  /** Path data with the baseline at y = 0 and the text starting at x = 0. */
  d: string;
  width: number;
  /** Line box above and below the baseline (positive numbers), as CSS lays it out. */
  ascent: number;
  descent: number;
}

const num = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};

export function shape(text: string, style: TextStyle): Shaped {
  const font = new hb.Font(face(style.family));
  font.setVariations([new hb.Variation("wght", style.weight ?? 400)]);
  const scale = style.size / face(style.family).upem;
  const tracking = (style.tracking ?? 0) * style.size;

  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer);

  const parts: string[] = [];
  let pen = 0;
  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  infos.forEach((info, i) => {
    const pos = positions[i];
    if (!pos) return;
    const ox = pen + pos.xOffset * scale;
    const oy = -pos.yOffset * scale;
    const raw = font.glyphToPath(info.codepoint);
    // Commands are absolute (M L Q C Z) in font units, y up: flip and place them.
    parts.push(
      raw.replace(/(-?[\d.]+),?\s*(-?[\d.]+)/g, (_, x: string, y: string) => {
        return `${num(ox + Number(x) * scale)} ${num(oy - Number(y) * scale)}`;
      }),
    );
    pen += pos.xAdvance * scale + tracking;
  });
  const ext = font.hExtents();
  // CSS adds letter spacing after the last glyph too; leave it out of the ink width.
  return {
    d: parts.join(""),
    width: pen - tracking,
    ascent: ext.ascender * scale,
    descent: -ext.descender * scale,
  };
}

/** A `<path>` with the text's baseline starting at (x, y). */
export function textPath(
  text: string,
  style: TextStyle,
  x: number,
  y: number,
  fill: string,
  attrs = "",
): string {
  const { d } = shape(text, style);
  return `<path transform="translate(${num(x)} ${num(y)})" fill="${fill}"${attrs} d="${d}"/>`;
}

export { num };
