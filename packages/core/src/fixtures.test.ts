import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readAmplDat } from "./ampl";
import { readMatpowerTables } from "./matpower";
import { readPlan } from "./plan";
import { redGfmgfl } from "./red-gfmgfl";
import { neutro, type Leer } from "./red-base";
import { redHidro } from "./red-hidro";
import { redReal } from "./red-real";
import { redMatpower } from "./red-matpower";
import { redMisocp } from "./red-misocp";
import {
  estrellasCaso,
  filaPorCol,
  horasPuntos,
  leerSitios,
  ngxDelCaso,
  puntosCaso,
  tablasSitio,
} from "./sitios";

// Fixtures live in packages/core/fixtures (public or synthetic only; see FIXTURES.md).
// This file is in packages/core/src, one level below the package.
const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(here, "../fixtures");

// Fixtures in the manifest that are not copied into the repository (FR-009: no SNI, CENACE or
// SDDP data, not even derived). Their tests are skipped and the reason is in FIXTURES.md.
const OMITIDOS: Record<string, string> = {
  "red/sitios/sintetico":
    "contiene un nombre de central tomado de un caso interno (FIXTURES.md); no se copia",
};
const estaOmitido = (key: string): boolean => Object.hasOwn(OMITIDOS, key);

interface ManifestEntry {
  fuente: string;
  md5: string;
  licencia?: string;
  entrada?: string;
}

/** A fixture input: the text of a single file, and the texts of every file by relative name. */
interface FixtureInput {
  text: string;
  files: Record<string, string>;
}

// Each reader is registered under the key without its last segment:
// `ampl/formas` -> `ampl`, `red/misocp/solo_base` -> `red/misocp`. The map is
// filled as readers land.
// The directory a MISOCP case is read under: red_misocp needs a base path that ends in
// /base.dat, so the case is read as if it lay in this virtual directory.
const VIRTUAL_CASE = "/caso";

// The MISOCP reader of a case: the base .dat first, then the tec_*.dat in lexicographic
// order (the rule of generar_fixtures.jl).
function readMisocpCase(input: FixtureInput): unknown {
  const tecnologias = Object.keys(input.files)
    .filter((name) => name.startsWith("tec_") && name.endsWith(".dat"))
    .sort();
  const rutas = ["base.dat", ...tecnologias].map((name) => `${VIRTUAL_CASE}/${name}`);
  return redMisocp(rutas, (ruta) => input.files[ruta.slice(VIRTUAL_CASE.length + 1)]);
}

// The site reader of a case directory: the sites, the NGX candidates, the hours and points,
// the star buses, the parsed tables and the IBRSITE rows as `_fila_por_col` gives them.
function readSitiosCase(input: FixtureInput): unknown {
  const leer: Leer = (ruta) => input.files[ruta.slice(VIRTUAL_CASE.length + 1)];
  const ngx = ngxDelCaso(VIRTUAL_CASE, leer);
  const horas = horasPuntos(VIRTUAL_CASE, leer);
  const { tablas, cabecera } = tablasSitio(leer(`${VIRTUAL_CASE}/ibr_sitios.dat`));
  const ibrsite = tablas.IBRSITE;
  const filas = ibrsite?.filas.map((f) => filaPorCol(f, ibrsite.columnas)?.valores ?? null) ?? [];
  return neutro({
    sitios: leerSitios(VIRTUAL_CASE, leer, { ngx, horas }),
    ngx,
    horas,
    puntos: puntosCaso(VIRTUAL_CASE, leer),
    estrellas: estrellasCaso(VIRTUAL_CASE, leer),
    tablas,
    cabecera,
    filas_ibrsite: filas,
  });
}

const READERS: Record<string, (input: FixtureInput) => unknown> = {
  ampl: (input) => readAmplDat(input.text),
  plan: (input) => readPlan(input.text),
  matpower: (input) => readMatpowerTables(input.text),
  "red/misocp": readMisocpCase,
  "red/gfmgfl": (input) => redGfmgfl([`${VIRTUAL_CASE}/input.dat`], () => input.files["input.dat"]),
  "red/matpower": (input) => redMatpower(input.text),
  "red/sitios": readSitiosCase,
  "red/real": (input) => redReal(input.text),
  "red/hidro": (input) =>
    redHidro(`${VIRTUAL_CASE}/etapas/etapas.csv`, (ruta) => input.files[ruta.slice(VIRTUAL_CASE.length + 1)]),
};

const manifest = JSON.parse(
  readFileSync(join(FIXTURES, "manifest.json"), "utf8"),
) as Record<string, ManifestEntry>;

/** Reader of a key: everything but its last segment (`red/misocp/solo_base` -> `red/misocp`). */
function readerOf(key: string): string {
  return key.split("/").slice(0, -1).join("/");
}

/** Relative names of every file under `dir`, `/` separated, in lexicographic order (research R6). */
function filesUnder(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? filesUnder(join(dir, entry.name), `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`],
    )
    .sort();
}

/** MD5 of a file, or of a directory as in the Julia `dir_md5` (research R6). */
function md5Of(path: string): string {
  if (statSync(path).isDirectory()) {
    const lines = filesUnder(path).map((name) => `${name}\n${md5Of(join(path, name))}\n`);
    return createHash("md5").update(lines.join("")).digest("hex");
  }
  return createHash("md5").update(readFileSync(path)).digest("hex");
}

/**
 * Input of a fixture, as in the Julia `fixture_input`: the input of another
 * fixture when the manifest names `entrada`, else its single `input.*` file or
 * its `input/` directory.
 */
function inputPathOf(key: string): string {
  const entry = manifest[key]!;
  if (entry.entrada) return join(FIXTURES, entry.entrada);
  const dir = join(FIXTURES, key);
  const names = readdirSync(dir);
  const inputs = names.filter((name) => name.startsWith("input."));
  if (names.includes("input")) {
    expect(inputs, `${key}: an input/ directory and input.* cannot coexist`).toHaveLength(0);
    return join(dir, "input");
  }
  expect(inputs, `${key} must have exactly one input.*`).toHaveLength(1);
  return join(dir, inputs[0]!);
}

/** Loads the input of a fixture: a file, or every file of an `input/` directory. */
function loadInput(key: string): FixtureInput {
  const path = inputPathOf(key);
  if (statSync(path).isDirectory()) {
    const files = Object.fromEntries(
      filesUnder(path).map((name) => [name, readFileSync(join(path, name), "utf8")]),
    );
    return { text: "", files };
  }
  const text = readFileSync(path, "utf8");
  return { text, files: { [basename(path)]: text } };
}

describe("shared fixtures manifest", () => {
  it("records a source and an MD5 for every entry", () => {
    for (const [key, entry] of Object.entries(manifest)) {
      expect(entry.fuente, `${key} needs a fuente`).toBeTruthy();
      expect(entry.md5, `${key} needs an md5`).toMatch(/^[0-9a-f]{32}$/);
    }
  });
});

// Keys of every fixture folder under red/ (a folder with an expected.json), relative to contracts/fixtures.
function redFolderKeys(dir: string, prefix = "red"): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  if (entries.some((e) => e.name === "expected.json")) return [prefix];
  return entries
    .filter((e) => e.isDirectory())
    .flatMap((e) => redFolderKeys(join(dir, e.name), `${prefix}/${e.name}`));
}

describe("red fixtures are registered (Principle II)", () => {
  it("every red/ folder has a manifest entry, and every red/ manifest entry has a folder", () => {
    const folders = redFolderKeys(join(FIXTURES, "red")).sort();
    const registered = Object.keys(manifest)
      .filter((key) => key.startsWith("red/") && !estaOmitido(key))
      .sort();
    expect(registered).toStrictEqual(folders);
  });

  it("the red/ inputs carry no SNI, CENACE or SDDP data by name (FR-009)", () => {
    for (const key of Object.keys(manifest).filter((k) => k.startsWith("red/") && !estaOmitido(k))) {
      const { files, text } = loadInput(key);
      const blob = [text, ...Object.values(files)].join("\n");
      expect(blob, `${key} must not carry SNI, CENACE or SDDP data`).not.toMatch(/CENACE|\.psr\b/);
    }
  });
});

describe.each(Object.keys(manifest))("fixture %s", (key) => {
  const entry = manifest[key]!;
  const omitido = estaOmitido(key);

  it.skipIf(omitido)("keeps the MD5 recorded in the manifest", () => {
    expect(md5Of(inputPathOf(key))).toBe(entry.md5);
  });

  it.skipIf(omitido)("matches its expected.json exactly", () => {
    const reader = readerOf(key);
    const run = READERS[reader];
    expect(run, `no TS reader registered for "${reader}"`).toBeDefined();
    const expected: unknown = JSON.parse(
      readFileSync(join(FIXTURES, key, "expected.json"), "utf8"),
    );
    expect(run!(loadInput(key))).toStrictEqual(expected);
  });
});
