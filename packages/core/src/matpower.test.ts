import { describe, expect, it } from "vitest";
import { readMatpowerTables, readRows, readTextTable, splitComment, tokenizeRow } from "./matpower";

describe("splitComment: the % that starts a comment", () => {
  it("splits code from the comment after %", () => {
    expect(splitComment("1 2 3 % bus one")).toStrictEqual(["1 2 3 ", "bus one"]);
  });

  it("returns an empty comment when the line has none", () => {
    expect(splitComment("1 2 3")).toStrictEqual(["1 2 3", ""]);
  });

  it("does not start a comment at a % inside single quotes", () => {
    expect(splitComment("'a%b' 2 % note")).toStrictEqual(["'a%b' 2 ", "note"]);
  });
});

describe("tokenizeRow: numbers, text and separators", () => {
  it("reads numbers as numbers and anything else as text", () => {
    expect(tokenizeRow("1 2.5 abc -3")).toStrictEqual([1, 2.5, "abc", -3]);
  });

  it("accepts a comma as separator", () => {
    expect(tokenizeRow("1,2")).toStrictEqual([1, 2]);
  });

  it("keeps a quoted value as text, without its quotes, even with spaces", () => {
    expect(tokenizeRow("1 'a b' 2")).toStrictEqual([1, "a b", 2]);
  });
});

describe("readRows: table rows with their comments", () => {
  it("separates rows with ';' on one line", () => {
    expect(readRows("mpc.bus = [1 2 3; 4 5 6];").bus).toStrictEqual([
      { values: [1, 2, 3], comment: "" },
      { values: [4, 5, 6], comment: "" },
    ]);
  });

  it("separates rows with a line break", () => {
    expect(readRows("mpc.bus = [\n 1 2\n 3 4\n];").bus).toStrictEqual([
      { values: [1, 2], comment: "" },
      { values: [3, 4], comment: "" },
    ]);
  });

  it("gives the comment of a line to the last row closed on that line", () => {
    expect(readRows("mpc.bus = [\n 1 2; 3 4; % two rows\n];").bus).toStrictEqual([
      { values: [1, 2], comment: "" },
      { values: [3, 4], comment: "two rows" },
    ]);
  });

  it("does not treat a % inside quotes as a comment", () => {
    expect(readRows("mpc.t = [\n 'L%1' 2;\n];").t).toStrictEqual([{ values: ["L%1", 2], comment: "" }]);
  });

  it("keeps a last row that has no closing ';'", () => {
    expect(readRows("mpc.bus = [\n 1 2\n];").bus).toStrictEqual([{ values: [1, 2], comment: "" }]);
  });

  it("omits a table that is not in the file", () => {
    expect(readRows("mpc.baseMVA = 100;")).toStrictEqual({});
  });
});

describe("readTextTable: tables of text between braces", () => {
  it("reads one unquoted string per row", () => {
    expect(readTextTable("mpc.gtnep_sssc = {\n 'L1';\n 'L2'\n};", "gtnep_sssc")).toStrictEqual(["L1", "L2"]);
  });

  it("returns an empty list when the table is absent", () => {
    expect(readTextTable("mpc.bus = [1 2;];", "gtnep_sssc")).toStrictEqual([]);
  });

  it("ignores comments before reading the braces", () => {
    expect(readTextTable("mpc.t = { % note\n 'A';\n};", "t")).toStrictEqual(["A"]);
  });
});

describe("readMatpowerTables: named sections bus, gen, branch and gencost", () => {
  it("maps bus columns by their MATPOWER position", () => {
    const { bus } = readMatpowerTables(
      "mpc.bus = [\n 1 3 80 24 0 0 1 1.05 10.5 138 1 1.06 0.94;\n];",
    );
    expect(bus).toStrictEqual([
      {
        id: 1,
        type: 3,
        pd: 80,
        qd: 24,
        gs: 0,
        bs: 0,
        area: 1,
        vm: 1.05,
        va: 10.5,
        base_kv: 138,
        zone: 1,
        vmax: 1.06,
        vmin: 0.94,
      },
    ]);
  });

  it("maps gen columns by their MATPOWER position", () => {
    const { gen } = readMatpowerTables("mpc.gen = [ 1 50 10 60 -10 1 100 1 200 0; ];");
    expect(gen).toStrictEqual([
      { bus: 1, pg: 50, qg: 10, qmax: 60, qmin: -10, vg: 1, mbase: 100, status: 1, pmax: 200, pmin: 0 },
    ]);
  });

  it("maps branch columns by their MATPOWER position", () => {
    const { branch } = readMatpowerTables("mpc.branch = [ 1 2 0.01 0.1 0.02 100 100 100 0 0 1; ];");
    expect(branch).toStrictEqual([
      {
        fbus: 1,
        tbus: 2,
        r: 0.01,
        x: 0.1,
        b: 0.02,
        rate_a: 100,
        rate_b: 100,
        rate_c: 100,
        tap: 0,
        shift: 0,
        status: 1,
      },
    ]);
  });

  it("maps gencost: model, startup, shutdown, n and the n coefficients after column 4", () => {
    const { gencost } = readMatpowerTables("mpc.gencost = [ 2 0 0 3 0.01 40 0; ];");
    expect(gencost).toStrictEqual([{ model: 2, startup: 0, shutdown: 0, n: 3, coeffs: [0.01, 40, 0] }]);
  });

  it("omits a column that the row does not have, instead of inventing a default", () => {
    const { bus } = readMatpowerTables("mpc.bus = [ 1 3 ;];");
    expect(bus).toStrictEqual([{ id: 1, type: 3 }]);
  });

  it("omits a numeric column that holds text", () => {
    const { bus } = readMatpowerTables("mpc.bus = [ 1 'x' 80 ;];");
    expect(bus).toStrictEqual([{ id: 1, pd: 80 }]);
  });

  it("returns empty lists for sections the file does not have", () => {
    const tables = readMatpowerTables("mpc.baseMVA = 100;");
    expect(tables.bus).toStrictEqual([]);
    expect(tables.gen).toStrictEqual([]);
    expect(tables.branch).toStrictEqual([]);
    expect(tables.gencost).toStrictEqual([]);
    expect(tables.tables).toStrictEqual({});
    expect(tables.textTables).toStrictEqual({});
  });

  it("collects every text table by name, in order of appearance", () => {
    const { textTables } = readMatpowerTables("mpc.gtnep_sssc = {\n 'L1';\n};\nmpc.gtnep_tcsc = {\n 'L2';\n};");
    expect(textTables).toStrictEqual({ gtnep_sssc: ["L1"], gtnep_tcsc: ["L2"] });
  });
});
