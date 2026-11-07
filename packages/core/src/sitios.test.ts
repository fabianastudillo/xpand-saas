import { describe, expect, it } from "vitest";
import {
  estrellasCaso,
  filaPorCol,
  horasPuntos,
  lineaDat,
  nombresInom,
  puntosCaso,
  tablasIbrSitios,
  tablasSitio,
} from "./sitios";
import type { Leer } from "./red-base";

// Files of a virtual case directory, read through the Leer callback.
const caso = (archivos: Record<string, string>): Leer => (ruta) => archivos[ruta.replace("/caso/", "")];
const DIR = "/caso";

describe("tablas_sitio: quotes as AMPL writes them (FR-006)", () => {
  it("'' is an escaped apostrophe inside a quoted text", () => {
    const { toks, texto } = lineaDat("1 'O''Neil' # comentario");
    expect(toks).toStrictEqual(["1", "O'Neil"]);
    expect(texto).toStrictEqual([false, true]);
  });

  it("a '#' inside quotes is text, not a comment, and the row is kept whole", () => {
    const { toks, coment } = lineaDat("1 'T_TOTO_ATQ#2' 230");
    expect(toks).toStrictEqual(["1", "T_TOTO_ATQ#2", "230"]);
    expect(coment).toBe("");
  });

  it("a ';' inside quotes does not end the table", () => {
    const tabla = tablasSitio(
      caso({
        "ibr_sitios.dat": [
          "param : IBRSITE_EXT : site nombre :=",
          "1 'a;b'",
          "2 'c'",
          ";",
        ].join("\n"),
      })(`${DIR}/ibr_sitios.dat`),
    ).tablas;
    expect(tabla.IBRSITE_EXT?.filas.map((f) => f.toks)).toStrictEqual([
      ["1", "a;b"],
      ["2", "c"],
    ]);
  });

  it("a table whose name has digits (TR3_ESTRELLA) is recognized", () => {
    const { tablas } = tablasSitio("param : TR3_ESTRELLA : id bus :=\n1 12\n;");
    expect(Object.keys(tablas)).toStrictEqual(["TR3_ESTRELLA"]);
  });
});

describe("_fila_por_col: token values by column (FR-010, D2)", () => {
  const cols = ["bus", "nombre", "csite"];

  it("a quoted token is text, and a numeric unquoted token is a number (comma as decimal point)", () => {
    const fila = tablasSitio(
      caso({ "ibr_sitios.dat": "param : T : bus nombre csite :=\n1 3 'Sol' 1,5\n;" })(`${DIR}/ibr_sitios.dat`),
    ).tablas.T!.filas[0]!;
    const r = filaPorCol(fila, cols);
    expect(r?.valores).toStrictEqual({ bus: 3, nombre: "Sol", csite: 1.5 });
    expect(r?.cabeza).toStrictEqual(["1"]);
  });

  it("a row with fewer tokens than columns gives no values", () => {
    const fila = tablasSitio(
      caso({ "ibr_sitios.dat": "param : T : bus nombre csite :=\n1 3\n;" })(`${DIR}/ibr_sitios.dat`),
    ).tablas.T!.filas[0]!;
    expect(filaPorCol(fila, cols)).toBeUndefined();
  });

  // Frozen reference behaviour (defect D3.3, not corrected here): an unquoted non-numeric token is NaN.
  it("[frozen, D3.3] an unquoted non-numeric token is NaN, not text", () => {
    const fila = tablasSitio(
      caso({ "ibr_sitios.dat": "param : T : bus nombre csite :=\n1 3 xyz 1\n;" })(`${DIR}/ibr_sitios.dat`),
    ).tablas.T!.filas[0]!;
    const r = filaPorCol(fila, cols);
    expect(Number.isNaN(r?.valores.nombre)).toBe(true);
  });
});

describe("puntos and hours of the case (puntos_caso, horas_puntos)", () => {
  it("puntos_caso takes the PUNTOS of ibr_sitios.dat when there is no puntos.dat", () => {
    const leer = caso({ "ibr_sitios.dat": "param : PUNTOS : punto horas :=\n3 10\n1 20\n;" });
    expect(puntosCaso(DIR, leer)).toStrictEqual([1, 3]);
  });

  it("puntos_caso gives [1] when there is no PUNTOS table", () => {
    expect(puntosCaso(DIR, caso({}))).toStrictEqual([1]);
  });

  it("horas_puntos reads the hours of each point from puntos.dat", () => {
    const leer = caso({ "puntos.dat": "param : PUNTOS : punto horas :=\n1 100\n2 250.5\n;" });
    expect(horasPuntos(DIR, leer)).toStrictEqual(
      new Map([
        [1, 100],
        [2, 250.5],
      ]),
    );
  });
});

describe("estrellas_caso: the star buses in ascending order (D2)", () => {
  it("lists the buses of ESTRELLA sorted, and leaves out a row with too few tokens", () => {
    const leer = caso({
      "estrellas.dat": "param : ESTRELLA : id bus kv nombre :=\n1 12 138 'E1'\n2 9 138 'E2'\n3 14\n;",
    });
    expect(estrellasCaso(DIR, leer)).toStrictEqual(["12", "9"].sort());
  });
});

describe("_tablas_ibr_sitios and _nombres_inom (read by red_misocp)", () => {
  it("a table without a ';' inside quotes keeps all its rows as text tokens", () => {
    const tablas = tablasIbrSitios("param : IBRPAV : site punto pav :=\n1 1 0.9\n1 2 0.4\n;");
    expect(tablas?.IBRPAV).toStrictEqual({
      columnas: ["site", "punto", "pav"],
      filas: [
        ["1", "1", "0.9"],
        ["1", "2", "0.4"],
      ],
    });
  });

  // Frozen reference behaviour (defect D3.1, not corrected here): the table ends at a ';' inside quotes.
  it("[frozen, D3.1] a ';' between quotes ends the table, and the rows after it are lost", () => {
    const tablas = tablasIbrSitios("param : NOTAS : id nota :=\n1 'uno;dos' # fila 1\n2 'tres' # fila 2\n;");
    expect(tablas?.NOTAS?.filas).toStrictEqual([["1", "'uno"]]);
  });

  it("the branch name and class come from the comment of inom.dat; a row without a class is left out", () => {
    const texto = [
      "param : INOM : br in_at_ka :=",
      "E1004_1003_2003 1.2 # T_Quijos [ElmTr2]",
      "param nombre # no es fila",
      "L2 0.5 # Linea Norte  [ElmLne]",
      "L3 0.9",
    ].join("\n");
    expect(nombresInom(texto)).toStrictEqual({
      E1004_1003_2003: ["T_Quijos", "ElmTr2"],
      L2: ["Linea Norte", "ElmLne"],
    });
  });

  it("without inom.dat there are no names", () => {
    expect(nombresInom(undefined)).toStrictEqual({});
  });
});
