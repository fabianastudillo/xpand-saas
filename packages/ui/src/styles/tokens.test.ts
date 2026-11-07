import { describe, expect, it } from "vitest";
import rawFontsCss from "./fonts.css?raw";
import rawThemeCss from "./theme.css?raw";
import rawCss from "./tokens.css?raw";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The stylesheets without comments, so prose never trips the parsers below. */
const css = stripComments(rawCss);
const themeCss = stripComments(rawThemeCss);
const fontsCss = stripComments(rawFontsCss);

/** WCAG 2.5.8: every pointer target at least 24×24 CSS px, also in compact density. */
const MIN_TARGET_PX = 24;

/** Minimum WCAG 2.2 AA contrast for text (1.4.3) and for UI component boundaries (1.4.11). */
const TEXT_MIN = 4.5;
const GRAPHIC_MIN = 3;

type TokenMap = ReadonlyMap<string, string>;

/** Collects `--name: value;` declarations of the first block whose selector matches. */
function parseBlock(source: string, selector: string): TokenMap {
  const start = source.indexOf(selector);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  const body = source.slice(open + 1, close);
  const entries = [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(
    (m) => [m[1] ?? "", (m[2] ?? "").trim()] as const,
  );
  return new Map(entries);
}

/** Follows `var(--x)` references until a literal value remains. */
function resolve(tokens: TokenMap, name: string, depth = 0): string {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`token not defined: ${name}`);
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  if (!ref) return value;
  if (depth > 8) throw new Error(`token reference too deep: ${name}`);
  return resolve(tokens, ref[1] ?? "", depth + 1);
}

function hexToRgb(hex: string): readonly [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a hex color: ${hex}`);
  const digits = m[1] ?? "";
  const full = digits.length === 3 ? digits.replace(/./g, "$&$&") : digits;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function channelLuminance(c8: number): number {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG 2.x contrast ratio between two colors, in the range 1..21. */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

const root = parseBlock(css, ":root");
const compact = parseBlock(css, '[data-density="compact"]');

const REQUIRED_TOKENS = [
  "--surface",
  "--surface-raised",
  "--ink",
  "--ink-muted",
  "--line",
  "--line-strong",
  "--accent",
  "--accent-ink",
  "--ok",
  "--ok-bg",
  "--ok-ink",
  "--warn",
  "--warn-bg",
  "--warn-ink",
  "--error",
  "--error-bg",
  "--error-ink",
  "--font-sans",
  "--font-mono",
  "--density",
] as const;

/** Text over its background: body text, muted text, badges, accent text and the primary button. */
const TEXT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["--ink", "--surface"],
  ["--ink-muted", "--surface"],
  ["--ink", "--surface-raised"],
  ["--ink-muted", "--surface-raised"],
  ["--accent", "--surface"],
  ["--accent-ink", "--accent"],
  ["--ok-ink", "--ok-bg"],
  ["--warn-ink", "--warn-bg"],
  ["--error-ink", "--error-bg"],
  ["--ok-ink", "--surface"],
  ["--warn-ink", "--surface"],
  ["--error-ink", "--surface"],
  // Muted text also sits on hovered rows and on the canvas grid; buttons keep their ink while hovered.
  ["--ink-muted", "--surface-sunken"],
  ["--ink-muted", "--grid-line"],
  ["--accent-ink", "--accent-hover"],
  ["--ink-inverse", "--ink"],
];

/** Non-text boundaries and status marks over the surfaces a control can sit on. */
const GRAPHIC_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["--line-strong", "--surface"],
  ["--line-strong", "--surface-sunken"],
  ["--line-strong", "--grid-line"],
  ["--ok", "--surface"],
  ["--warn", "--surface"],
  ["--error", "--surface"],
];

/** Heights of interactive controls, in both density blocks. */
const INTERACTIVE_HEIGHTS = ["--control-h", "--control-h-sm", "--row-h"] as const;

describe("tokens.css", () => {
  it("defines every token the brief names", () => {
    for (const name of REQUIRED_TOKENS) {
      expect(root.has(name), name).toBe(true);
    }
  });

  it("uses IBM Plex Sans for text and IBM Plex Mono for figures", () => {
    expect(resolve(root, "--font-sans")).toMatch(/^"IBM Plex Sans"/);
    expect(resolve(root, "--font-mono")).toMatch(/^"IBM Plex Mono"/);
  });

  it("declares the normal density and a compact mode that tightens the rhythm", () => {
    expect(resolve(root, "--density")).toBe("normal");
    expect(resolve(compact, "--density")).toBe("compact");
    const normalRow = Number.parseFloat(resolve(root, "--row-h"));
    const compactRow = Number.parseFloat(resolve(compact, "--row-h"));
    expect(compactRow).toBeLessThan(normalRow);
  });

  it.each(TEXT_PAIRS)("text %s on %s reaches 4.5:1", (fg, bg) => {
    const ratio = contrastRatio(resolve(root, fg), resolve(root, bg));
    expect(ratio).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it.each(GRAPHIC_PAIRS)("boundary %s on %s reaches 3:1", (fg, bg) => {
    const ratio = contrastRatio(resolve(root, fg), resolve(root, bg));
    expect(ratio).toBeGreaterThanOrEqual(GRAPHIC_MIN);
  });

  it("keeps the semantic colors distinct (color carries meaning)", () => {
    const colors = ["--ok", "--warn", "--error", "--accent"].map((n) => resolve(root, n).toLowerCase());
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("stays plain CSS: hex literals and var() only, so the app can load it without Tailwind", () => {
    expect(css).not.toMatch(/@theme|@apply|oklch\(|color-mix\(/);
  });

  it.each(INTERACTIVE_HEIGHTS)("%s keeps a 24px target in normal and compact density", (name) => {
    expect(Number.parseFloat(resolve(root, name))).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    expect(Number.parseFloat(resolve(compact, name))).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  });

  it("declares the sticky bar heights that scroll-padding uses", () => {
    expect(root.has("--topbar-h")).toBe(true);
    expect(root.has("--statusbar-h")).toBe(true);
  });
});

describe("theme.css", () => {
  it("is an inline reference theme: Tailwind emits no variables, so a mapping like --font-sans: var(--font-sans) never self-references", () => {
    expect(themeCss).toMatch(/@theme\s+inline\s+reference\s*\{/);
    expect(themeCss.match(/@theme/g)).toHaveLength(1);
  });

  it("only references tokens that tokens.css defines", () => {
    const referenced = [...themeCss.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1] ?? "");
    expect(referenced.length).toBeGreaterThan(20);
    for (const name of referenced) {
      expect(root.has(name), name).toBe(true);
    }
  });
});

describe("fonts.css", () => {
  it("bundles only the latin subsets and no italic faces", () => {
    const imports = [...fontsCss.matchAll(/@import\s+"([^"]+)"/g)].map((m) => m[1] ?? "");
    expect(imports.length).toBeGreaterThan(0);
    for (const path of imports) {
      expect(path, path).toMatch(/^@fontsource\/ibm-plex-(sans|mono)\/latin-\d{3}\.css$/);
    }
  });
});

describe("contrastRatio", () => {
  it("returns 21 for black on white and 1 for identical colors", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#0b5fff", "#0b5fff")).toBe(1);
  });
});
