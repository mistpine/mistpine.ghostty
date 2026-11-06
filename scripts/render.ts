/**
 * Renders the README images from Ghostty itself:
 *
 * - assets/preview.png: Neovim (mistpine.nvim) beside an unfocused split.
 * - assets/screenshots/{shell,palette,search}.png: git and ripgrep output,
 *   the 16 colors with text styles and a selection, Ghostty's search.
 *
 * Ghostty runs under Xvfb with Mesa's software OpenGL. The theme is installed
 * by name under an isolated XDG_CONFIG_HOME, as the README tells users to.
 * Each screenshot is then checked pixel by pixel: the theme's colors must
 * appear exactly, or the render fails.
 *
 * Needs Ghostty 1.3+, Xvfb, xdotool and ImageMagick, Neovim 0.11+ with the
 * Python parser and nvim-treesitter's queries, git, ripgrep and eza.
 *
 *   GHOSTTY           Ghostty executable (default: ghostty)
 *   MISTPINE_NVIM     mistpine.nvim checkout (default: ../mistpine.nvim)
 *   NVIM_TS_QUERIES   dir containing queries/python (default: lazy.nvim's nvim-treesitter/runtime)
 *   NVIM_TS_PARSERS   dir containing parser/python.so (default: stdpath("data")/site)
 */
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { contrast, ROOT } from "./lib/colors.ts";

const GHOSTTY = process.env.GHOSTTY ?? "ghostty";
const RENDER = join(ROOT, "scripts", "render");
const WORK = join(ROOT, ".render");
const REPO = join(WORK, "fog");
const XDG = join(WORK, "config");
const data = process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");
const NVIM_ENV = {
  MISTPINE_NVIM: process.env.MISTPINE_NVIM ?? join(ROOT, "..", "mistpine.nvim"),
  NVIM_TS_QUERIES:
    process.env.NVIM_TS_QUERIES ?? join(data, "nvim", "lazy", "nvim-treesitter", "runtime"),
  NVIM_TS_PARSERS: process.env.NVIM_TS_PARSERS ?? join(data, "nvim", "site"),
};
if (!existsSync(join(NVIM_ENV.MISTPINE_NVIM, "colors", "mistpine.lua"))) {
  throw new Error(`no mistpine.nvim at ${NVIM_ENV.MISTPINE_NVIM}: set MISTPINE_NVIM`);
}

// ---------------------------------------------------------------- theme

/** The theme's colors, read back from the file being rendered. */
const theme = new Map<string, string>();
for (const line of readFileSync(join(ROOT, "themes", "mistpine"), "utf8").split("\n")) {
  const m = line.match(/^([a-z-]+) = (?:(\d+)=)?(#[0-9a-f]{6})$/);
  if (m) theme.set(m[2] ? `palette ${m[2]}` : (m[1] as string), m[3] as string);
}
const t = (key: string): string => {
  const v = theme.get(key);
  if (!v) throw new Error(`themes/mistpine has no ${key}`);
  return v;
};

// ---------------------------------------------------------------- sample repo

/** A small git repo with a branch, a merge, a tag and an unstaged change. */
function sampleRepo(): void {
  rmSync(WORK, { recursive: true, force: true });
  cpSync(join(RENDER, "sample"), REPO, { recursive: true });
  let clock = Date.parse("2026-10-12T09:00:00Z") / 1000;
  const git = (...args: string[]) => {
    clock += 5400;
    execFileSync("git", args, {
      cwd: REPO,
      stdio: "ignore",
      env: {
        ...gitEnv,
        GIT_AUTHOR_DATE: `${clock} +0000`,
        GIT_COMMITTER_DATE: `${clock} +0000`,
      },
    });
  };
  const edit = (file: string, from: string, to: string) => {
    const path = join(REPO, file);
    const text = readFileSync(path, "utf8");
    if (!text.includes(from)) throw new Error(`sample: ${file} has no ${JSON.stringify(from)}`);
    writeFileSync(path, text.replace(from, to));
  };

  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-qm", "feat: record ridge readings");
  git("tag", "v0.1.0");
  git("switch", "-qc", "ridge-alerts");
  edit("fog/stations.py", '"ridge-01"', '"ridge-01",\n    "ridge-04"');
  git("commit", "-qam", "feat(stations): add ridge-04");
  edit(
    "tests/test_forecast.py",
    "def test_",
    "def test_ridge_alerts():\n    assert True\n\n\ndef test_",
  );
  git("commit", "-qam", "test: cover ridge alerts");
  git("switch", "-q", "main");
  edit("README.md", "## Limits", "## Limits\n\nReadings older than `max_age` are ignored.");
  git("commit", "-qam", "docs: explain reading age");
  git("merge", "-q", "--no-ff", "ridge-alerts", "-m", "merge: ridge alerts");
  edit("pyproject.toml", "\n", "\n# fog forecasts\n");
  git("commit", "-qam", "chore: describe the project");
  git("tag", "v0.2.0");
  // Left unstaged for `git diff`.
  edit("fog/forecast.py", "FOG_LIMIT = 1_000", "FOG_LIMIT = 800");
}

/** git without the user's own config, so its default colors show. */
const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "mistpine",
  GIT_AUTHOR_EMAIL: "mistpine@example.com",
  GIT_COMMITTER_NAME: "mistpine",
  GIT_COMMITTER_EMAIL: "mistpine@example.com",
};

// ---------------------------------------------------------------- X and Ghostty

let display = "";
let xvfb: ChildProcess | undefined;

async function startX(): Promise<void> {
  for (let n = 99; n < 120; n++) {
    if (existsSync(`/tmp/.X11-unix/X${n}`)) continue;
    display = `:${n}`;
    xvfb = spawn("Xvfb", [display, "-screen", "0", "4000x2800x24", "-nolisten", "tcp"], {
      stdio: "ignore",
    });
    for (let i = 0; i < 50 && !existsSync(`/tmp/.X11-unix/X${n}`); i++) await sleep(100);
    if (existsSync(`/tmp/.X11-unix/X${n}`)) return;
  }
  throw new Error("could not start Xvfb");
}

const env = (extra: Record<string, string> = {}) => {
  const base: Record<string, string | undefined> = {
    ...gitEnv,
    ...NVIM_ENV,
    DISPLAY: display,
    GDK_BACKEND: "x11",
    // 2× like the other ports' screenshots.
    GDK_SCALE: "2",
    LIBGL_ALWAYS_SOFTWARE: "1",
    XDG_CONFIG_HOME: XDG,
    RENDER_DIR: RENDER,
    RENDER_REPO: REPO,
    ...extra,
  };
  // The tools' own defaults, not the user's color settings.
  for (const key of ["LS_COLORS", "EZA_COLORS", "NO_COLOR", "RIPGREP_CONFIG_PATH", "TMUX"]) {
    delete base[key];
  }
  return base as NodeJS.ProcessEnv;
};

const x = (cmd: string, ...args: string[]) =>
  execFileSync(cmd, args, { env: env(), encoding: "utf8" }).trim();

interface Scene {
  name: string;
  out: string;
  cols: number;
  rows: number;
  /** The first surface's command; later splits run `command`. */
  initial: string;
  command?: string;
  act?: (scene: { win: string; mark: string; shot: () => Promise<Image> }) => Promise<void>;
  /** Exact colors that must appear, at least `min` pixels each. */
  expect: [label: string, hex: string, min: number][];
  /** Colors Ghostty composites (unfocused splits), ±1 per channel, by half of the window. */
  approx?: { label: string; hex: string; half: "left" | "right"; min?: number; max?: number }[];
}

async function runScene(scene: Scene): Promise<void> {
  const mark = join(WORK, `${scene.name}.ready`);
  rmSync(mark, { force: true });
  mkdirSync(join(XDG, "ghostty", "themes"), { recursive: true });
  cpSync(join(ROOT, "themes", "mistpine"), join(XDG, "ghostty", "themes", "mistpine"));
  writeFileSync(
    join(XDG, "ghostty", "config"),
    [
      "theme = mistpine",
      // Window chrome follows the terminal colors instead of Adwaita's gray.
      "window-theme = ghostty",
      `window-width = ${scene.cols}`,
      `window-height = ${scene.rows}`,
      "window-padding-x = 14",
      "window-padding-y = 10",
      "window-padding-balance = true",
      "font-size = 13",
      "cursor-style = block",
      "cursor-style-blink = false",
      "shell-integration = none",
      "confirm-close-surface = false",
      "gtk-single-instance = false",
      "resize-overlay = never",
      "app-notifications = false",
      `working-directory = ${REPO}`,
      `initial-command = ${scene.initial}`,
      `command = ${scene.command ?? "bash --noprofile --norc"}`,
      "",
    ].join("\n"),
  );

  const ghostty = spawn(GHOSTTY, [], { env: env({ RENDER_MARK: mark }), stdio: "ignore" });
  try {
    const win = x(
      "timeout",
      "30",
      "xdotool",
      "search",
      "--sync",
      "--onlyvisible",
      "--class",
      "ghostty",
    )
      .split("\n")
      .at(-1) as string;
    x("xdotool", "windowmove", win, "0", "0");
    x("xdotool", "windowfocus", "--sync", win);
    await waitFor(mark);
    await sleep(1500);
    const shot = async () => capture(win);
    await scene.act?.({ win, mark, shot });
    const image = await shot();
    check(scene, image);
    const out = join(ROOT, scene.out);
    mkdirSync(join(out, ".."), { recursive: true });
    execFileSync("convert", [image.file, "-strip", out]);
    console.log(`wrote ${scene.out} (${image.width}×${image.height})`);
  } finally {
    ghostty.kill("SIGTERM");
    await sleep(500);
  }
}

async function waitFor(file: string, seconds = 30): Promise<void> {
  for (let i = 0; i < seconds * 10; i++) {
    if (existsSync(file)) return;
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${file}`);
}

const keys = async (...combos: string[]) => {
  for (const combo of combos) {
    x("xdotool", "key", "--clearmodifiers", combo);
    await sleep(400);
  }
};

// ---------------------------------------------------------------- pixels

interface Image {
  file: string;
  width: number;
  height: number;
  rgb: Buffer;
}

async function capture(win: string): Promise<Image> {
  await sleep(700);
  const file = join(WORK, `shot-${win}.png`);
  x("import", "-window", win, file);
  const [width, height] = x("identify", "-format", "%w %h", file).split(" ").map(Number) as [
    number,
    number,
  ];
  const rgb = execFileSync("convert", [file, "-depth", "8", "rgb:-"], {
    maxBuffer: 256 * 1024 * 1024,
  });
  return { file, width, height, rgb };
}

const channels = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

function count(image: Image, hex: string, tolerance = 0, half?: "left" | "right"): number {
  const [r, g, b] = channels(hex) as [number, number, number];
  const mid = image.width / 2;
  let n = 0;
  for (let i = 0; i < image.rgb.length; i += 3) {
    const px = (i / 3) % image.width;
    if ((half === "left" && px >= mid) || (half === "right" && px < mid)) continue;
    if (
      Math.abs((image.rgb[i] as number) - r) <= tolerance &&
      Math.abs((image.rgb[i + 1] as number) - g) <= tolerance &&
      Math.abs((image.rgb[i + 2] as number) - b) <= tolerance
    ) {
      n++;
    }
  }
  return n;
}

/** The first solid block of a color, top-left first: [x, y, width, height]. */
function block(image: Image, hex: string): [number, number, number, number] {
  const [r, g, b] = channels(hex) as [number, number, number];
  const is = (px: number, py: number) => {
    const i = (py * image.width + px) * 3;
    return image.rgb[i] === r && image.rgb[i + 1] === g && image.rgb[i + 2] === b;
  };
  for (let py = 0; py < image.height; py++) {
    for (let px = 0; px < image.width; px++) {
      if (!is(px, py)) continue;
      let w = 0;
      while (px + w < image.width && is(px + w, py)) w++;
      let h = 0;
      while (py + h < image.height && is(px, py + h)) h++;
      // Glyphs are thin; a swatch is many pixels both ways.
      if (w > 40 && h > 20) return [px, py, w, h];
    }
  }
  throw new Error(`no block of ${hex}`);
}

function check(scene: Scene, image: Image): void {
  const fails: string[] = [];
  for (const [label, hex, min] of scene.expect) {
    const n = count(image, hex);
    if (n < min) fails.push(`${label} ${hex}: ${n} exact pixels, want ≥ ${min}`);
  }
  for (const { label, hex, half, min = 0, max = Number.POSITIVE_INFINITY } of scene.approx ?? []) {
    const n = count(image, hex, 1, half);
    if (n < min || n > max) {
      fails.push(`${label} ≈${hex}: ${n} pixels in the ${half} half, want ${min}–${max}`);
    }
  }
  if (fails.length) throw new Error(`${scene.name}: colors off\n  ${fails.join("\n  ")}`);
  console.log(`${scene.name}: ${scene.expect.length + (scene.approx?.length ?? 0)} colors exact`);
}

/** sRGB alpha blend, as GTK composites the unfocused-split overlay. */
function over(base: string, fill: string, alpha: number): string {
  const [a, b] = [channels(base), channels(fill)];
  return `#${a
    .map((v, i) =>
      Math.round(v + ((b[i] as number) - v) * alpha)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

// ---------------------------------------------------------------- scenes

const dimmed = over(t("background"), t("unfocused-split-fill"), 0.3);

const sh = (script: string) => `bash --noprofile --norc ${join(RENDER, script)}`;
const ANSI = Array.from({ length: 16 }, (_, i) => [`palette ${i}`, t(`palette ${i}`), 2000]) as [
  string,
  string,
  number,
][];

const scenes: Scene[] = [
  {
    name: "preview",
    out: "assets/preview.png",
    cols: 172,
    rows: 40,
    initial: `nvim --clean -i NONE -u ${join(RENDER, "init.lua")} fog/forecast.py`,
    command: sh("split.sh"),
    async act({ win, mark }) {
      // Split right, wait for the new shell to finish, then click Neovim to focus it.
      rmSync(mark);
      await keys("ctrl+shift+o");
      await waitFor(mark);
      await sleep(1000);
      x("xdotool", "mousemove", "--window", win, "600", "1500", "click", "1");
      x("xdotool", "mousemove", "--window", win, "5", "1975");
    },
    expect: [
      ["background", t("background"), 50_000],
      ["split divider", t("split-divider-color"), 300],
    ],
    // Ghostty dims unfocused splits with the fill at 1 - unfocused-split-opacity (0.7):
    // the shell on the right, not Neovim on the left (a few thousand edge pixels match).
    approx: [
      { label: "unfocused split", hex: dimmed, half: "right", min: 200_000 },
      { label: "focused split", hex: dimmed, half: "left", max: 50_000 },
    ],
  },
  {
    name: "shell",
    out: "assets/screenshots/shell.png",
    cols: 100,
    rows: 40,
    initial: sh("shell.sh"),
    expect: [
      ["background", t("background"), 50_000],
      ["cursor", t("cursor-color"), 80],
    ],
  },
  {
    name: "palette",
    out: "assets/screenshots/palette.png",
    cols: 100,
    rows: 18,
    initial: sh("palette.sh"),
    async act({ win, shot }) {
      // Find the swatches to learn the cell size, then drag across a line.
      const image = await shot();
      const [rx, ry, rw, rh] = block(image, t("palette 1"));
      const cw = rw / 11;
      const ch = rh / 2;
      // Row 1 holds the first swatches; the selected line is row 11, from column 2.
      const y = Math.round(ry + (10 + 0.5) * ch);
      const left = rx - 12 * cw;
      const from = left + 15.5 * cw;
      const to = left + 56.5 * cw;
      const move = (px: number) =>
        x("xdotool", "mousemove", "--window", win, String(Math.round(px)), String(y));
      move(from);
      x("xdotool", "mousedown", "1");
      for (let i = 1; i <= 8; i++) {
        move(from + ((to - from) * i) / 8);
        await sleep(60);
      }
      x("xdotool", "mouseup", "1");
      // Park the pointer away from the text.
      x("xdotool", "mousemove", "--window", win, "5", String(image.height - 5));
    },
    expect: [
      ["background", t("background"), 30_000],
      ...ANSI,
      ["selection", t("selection-background"), 2000],
    ],
  },
  {
    name: "search",
    out: "assets/screenshots/search.png",
    cols: 100,
    rows: 40,
    initial: sh("shell.sh"),
    async act() {
      await keys("ctrl+shift+f");
      x("xdotool", "type", "--delay", "80", "fog");
      await sleep(800);
      await keys("Return", "Return");
    },
    expect: [
      ["background", t("background"), 50_000],
      ["search match", t("search-background"), 400],
      ["selected match", t("search-selected-background"), 100],
    ],
  },
];

// ---------------------------------------------------------------- main

const only = process.argv.slice(2);
sampleRepo();
await startX();
try {
  for (const scene of scenes) {
    if (only.length && !only.includes(scene.name)) continue;
    await runScene(scene);
  }
} finally {
  xvfb?.kill();
}
const ratio = contrast(t("foreground"), t("background")).toFixed(1);
console.log(`done: foreground on background ${ratio}:1`);
