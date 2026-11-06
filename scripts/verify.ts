/**
 * Checks themes/mistpine with Ghostty itself.
 *
 *   pnpm verify    (needs Ghostty 1.3+: `ghostty` on PATH, or GHOSTTY=/path)
 *
 * 1. `ghostty +validate-config` must accept the theme with no diagnostics.
 * 2. Installed the way the README says (themes/mistpine under an isolated
 *    XDG_CONFIG_HOME, `theme = mistpine`), every color Ghostty reports in
 *    `+show-config` must equal the theme file, and the theme file the spec.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSpec, ROOT } from "./lib/colors.ts";

const GHOSTTY = process.env.GHOSTTY ?? "ghostty";
const THEME = join(ROOT, "themes", "mistpine");

/** `key = value` lines; palette entries become `palette N`. */
function parse(text: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of text.split("\n")) {
    const m = line.match(/^([a-z0-9-]+) = (.*)$/);
    if (!m) continue;
    const [, key, value] = m as unknown as [string, string, string];
    const p = key === "palette" ? value.match(/^(\d+)=(.*)$/) : null;
    if (p) values.set(`palette ${p[1]}`, (p[2] as string).toLowerCase());
    else values.set(key, value.toLowerCase());
  }
  return values;
}

function fail(message: string): never {
  console.error(`verify: ${message}`);
  process.exit(1);
}

const version = execFileSync(GHOSTTY, ["+version"], { encoding: "utf8" }).match(
  /version: (\d+)\.(\d+)\.(\d+)/,
);
if (!version) fail(`could not read the version of ${GHOSTTY}`);
const [major, minor] = [Number(version[1]), Number(version[2])];
if (major < 1 || (major === 1 && minor < 3)) fail(`needs Ghostty 1.3+, found ${version[0]}`);
console.log(`Ghostty ${version.slice(1).join(".")}`);

// 1. The theme on its own, as Ghostty's validator sees it.
const validate = spawnSync(GHOSTTY, ["+validate-config", `--config-file=${THEME}`], {
  encoding: "utf8",
});
const diagnostics = `${validate.stdout}${validate.stderr}`.trim();
if (validate.status !== 0 || diagnostics) {
  fail(`+validate-config rejected the theme (exit ${validate.status}):\n${diagnostics}`);
}
console.log("+validate-config: no diagnostics");

// 2. Installed by name, then read back from Ghostty's resolved config.
const home = mkdtempSync(join(tmpdir(), "mistpine-ghostty-"));
try {
  const dir = join(home, "ghostty");
  mkdirSync(join(dir, "themes"), { recursive: true });
  copyFileSync(THEME, join(dir, "themes", "mistpine"));
  writeFileSync(join(dir, "config"), "theme = mistpine\n");
  const shown = spawnSync(GHOSTTY, ["+show-config"], {
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: home },
  });
  if (shown.status !== 0) fail(`+show-config failed:\n${shown.stderr}`);
  const effective = parse(shown.stdout);
  const theme = parse(readFileSync(THEME, "utf8"));

  for (const [key, want] of theme) {
    const got = effective.get(key);
    if (got !== want)
      fail(`Ghostty resolves ${key} to ${got ?? "(default)"}, the theme sets ${want}`);
  }
  console.log(`+show-config: all ${theme.size} theme colors in effect`);

  // The theme against the spec, independently of the generator.
  const { spec } = await loadSpec();
  const t = spec.terminal;
  const expected: Record<string, string | undefined> = {
    background: t.background?.hex,
    foreground: t.foreground?.hex,
    "cursor-color": t.cursor?.hex,
    "cursor-text": t.cursorText?.hex,
    "selection-background": t.selectionBg?.hex,
    "selection-foreground": t.selectionFg?.hex,
    "search-background": spec.ui.searchBg?.hex,
    "search-foreground": spec.ui.editorFg?.hex,
    "search-selected-background": spec.ui.curSearchBg?.hex,
    "search-selected-foreground": spec.ui.editorBg?.hex,
    "split-divider-color": spec.ui.border?.hex,
    "unfocused-split-fill": spec.ui.panelBg?.hex,
    ...Object.fromEntries(spec.ansi.map((token, i) => [`palette ${i}`, token.hex])),
  };
  for (const [key, want] of Object.entries(expected)) {
    if (!want) fail(`the spec has no color for ${key}`);
    if (effective.get(key) !== want.toLowerCase()) {
      fail(`${key} is ${effective.get(key)} in Ghostty, ${want} in the spec`);
    }
  }
  if (theme.size !== Object.keys(expected).length) {
    fail(`the theme sets ${theme.size} colors, the spec maps ${Object.keys(expected).length}`);
  }
  console.log("spec: every mapped color matches palette/mistpine.json");
} finally {
  rmSync(home, { recursive: true, force: true });
}
