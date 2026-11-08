import { describe, expect, it } from "vitest";
import { clave1, escalar, leerDats, par, readAmplDat, valores } from "./ampl";

describe("readAmplDat: the seven forms of ampldat.jl", () => {
  it("reads a simple set", () => {
    expect(readAmplDat("set BUS := 1 2 3;").sets).toStrictEqual({
      BUS: [["1"], ["2"], ["3"]],
    });
  });

  it("reads tuples in a set as arrays of tokens", () => {
    expect(readAmplDat("set BRANCH := (1,2,1) (2,3,1);").sets.BRANCH).toStrictEqual([
      ["1", "2", "1"],
      ["2", "3", "1"],
    ]);
  });

  it("keeps the brackets of an indexed set name", () => {
    expect(readAmplDat("set HSEC[PUN] := ;").sets).toStrictEqual({ "HSEC[PUN]": [] });
  });

  it("reads a set whose elements span several lines", () => {
    expect(readAmplDat("set GEN := g1 g2\n  g3;").sets.GEN).toStrictEqual([["g1"], ["g2"], ["g3"]]);
  });

  it("reads a scalar parameter as a number", () => {
    expect(readAmplDat("param Sbase := 100;").scalars).toStrictEqual({ Sbase: 100 });
  });

  it("keeps a scalar text value as a string", () => {
    expect(readAmplDat("param solver := gurobi;").scalars).toStrictEqual({ solver: "gurobi" });
  });

  it("reads an indexed parameter with one key per line", () => {
    const { params } = readAmplDat("param Pd :=\n  2 50\n  3 75.5\n;");
    expect(params.Pd).toStrictEqual([
      { key: ["2"], value: 50 },
      { key: ["3"], value: 75.5 },
    ]);
  });

  it("reads the bracket variant with several pairs on one line", () => {
    const { params } = readAmplDat("param DSCC := [8,2,5,2] 0.5 [8,2,6,2] 0.25;");
    expect(params.DSCC).toStrictEqual([
      { key: ["8", "2", "5", "2"], value: 0.5 },
      { key: ["8", "2", "6", "2"], value: 0.25 },
    ]);
  });

  it("reads a matrix with the first index as the row", () => {
    const { params } = readAmplDat("param X : c1 c2 :=\n  f1 1.5 2.5\n  f2 3 4\n;");
    expect(params.X).toStrictEqual([
      { key: ["f1", "c1"], value: 1.5 },
      { key: ["f1", "c2"], value: 2.5 },
      { key: ["f2", "c1"], value: 3 },
      { key: ["f2", "c2"], value: 4 },
    ]);
  });

  it("declares the index set in the table form `param : SET : cols :=`", () => {
    const { sets, params } = readAmplDat("param : NODO : tipo Pd :=\n  1 2 51\n  2 1 0\n;");
    expect(sets.NODO).toStrictEqual([["1"], ["2"]]);
    expect(params.tipo).toStrictEqual([
      { key: ["1"], value: 2 },
      { key: ["2"], value: 1 },
    ]);
    expect(params.Pd).toStrictEqual([
      { key: ["1"], value: 51 },
      { key: ["2"], value: 0 },
    ]);
  });

  it("reads a table over an index set that is already declared", () => {
    const { sets, params } = readAmplDat("param : c1 c2 :=\n  1 0.5 0.6\n;");
    expect(sets).toStrictEqual({});
    expect(params.c1).toStrictEqual([{ key: ["1"], value: 0.5 }]);
    expect(params.c2).toStrictEqual([{ key: ["1"], value: 0.6 }]);
  });
});

describe("readAmplDat: tokens, comments and unknown statements", () => {
  it("treats '.' as no data: the entry is not stored", () => {
    const { params } = readAmplDat("param Pmax :=\n  1 100\n  2 .\n;");
    expect(params.Pmax).toStrictEqual([{ key: ["1"], value: 100 }]);
  });

  it("stores a scalar '.' as null, as Julia stores nothing (decision D2 of 003)", () => {
    expect(readAmplDat("param Z := .;").scalars).toStrictEqual({ Z: null });
  });

  it("keeps an unrecognized statement verbatim in raw", () => {
    expect(readAmplDat("option solver gurobi;\ndisplay Pd;").raw).toStrictEqual([
      "option solver gurobi",
      "display Pd",
    ]);
  });

  it("does not throw on a form it does not know", () => {
    expect(() => readAmplDat("param A := 1 2 3 4 5 6 7;")).not.toThrow();
  });

  it("ignores # comments, including a ';' inside one", () => {
    const { sets } = readAmplDat("# a note; set FAKE := x;\nset BUS := 1; # trailing; text\n");
    expect(sets).toStrictEqual({ BUS: [["1"]] });
  });

  it("reads signs, a bare decimal point and exponents", () => {
    const { scalars } = readAmplDat("param a := +3.;\nparam b := .5;\nparam c := 1E-3;");
    expect(scalars).toStrictEqual({ a: 3, b: 0.5, c: 0.001 });
  });

  it("sorts the entries of a parameter by key, element by element", () => {
    const { params } = readAmplDat("param P :=\n  2 1\n  10 1\n  1 1\n;");
    expect(params.P?.map((entry) => entry.key)).toStrictEqual([["1"], ["10"], ["2"]]);
  });
});

describe("readAmplDat: merging several sources", () => {
  it("merges in order, so a later source overwrites an earlier one", () => {
    const { scalars } = readAmplDat(["param Sbase := 100;", "param Sbase := 50;"]);
    expect(scalars).toStrictEqual({ Sbase: 50 });
  });

  it("a redeclared set overwrites the earlier declaration", () => {
    const { sets } = readAmplDat(["set BUS := 1 2;", "set BUS := 3;"]);
    expect(sets.BUS).toStrictEqual([["3"]]);
  });

  it("keeps the parameters of every source", () => {
    const { params } = readAmplDat(["param Pd :=\n  1 5\n;", "param Pd :=\n  2 7\n;"]);
    expect(params.Pd).toStrictEqual([
      { key: ["1"], value: 5 },
      { key: ["2"], value: 7 },
    ]);
  });
});

describe("leerDats and the Datos queries of ampldat.jl (research R5)", () => {
  it("merges texts in order: a later text overwrites an earlier one", () => {
    const d = leerDats(["param Sbase := 100;", "param Sbase := 50;"]);
    expect(escalar(d, "Sbase")).toBe(50);
  });

  it("clave1 keeps the one-dimensional elements of a set in order of appearance", () => {
    const d = leerDats(["set BUS := 3 1 2;", "set BRANCH := (1,2,1) (2,3,1);"]);
    expect(clave1(d, "BUS")).toStrictEqual(["3", "1", "2"]);
    expect(clave1(d, "BRANCH")).toStrictEqual([]);
  });

  it("valores is empty for an absent set, and returns tuples for a tuple set", () => {
    const d = leerDats(["set BRANCH := (1,2,1) (2,3,1);"]);
    expect(valores(d, "BRANCH")).toStrictEqual([
      ["1", "2", "1"],
      ["2", "3", "1"],
    ]);
    expect(valores(d, "MISSING")).toStrictEqual([]);
  });

  it("declares an index set with a table and keeps its elements without repeats", () => {
    const d = leerDats([
      "param : BUS : bus_type Pd :=\n1 1 50\n2 1 30\n;",
      "param : BUS : bus_type Pd :=\n2 1 30\n3 2 10\n;",
    ]);
    expect(clave1(d, "BUS")).toStrictEqual(["1", "2", "3"]);
  });

  it("par looks up an indexed value by its key, and is undefined when absent", () => {
    const d = leerDats(["param Pmax :=\n1 100\n2 70\n;"]);
    expect(par(d, "Pmax", "2")).toBe(70);
    expect(par(d, "Pmax", "9")).toBeUndefined();
    expect(par(d, "Pmin", "1")).toBeUndefined();
  });

  it("par accepts a multi-index key as a list of tokens", () => {
    const d = leerDats(["param : LINE : c_a c_b :=\n1 2 3 4\n;"]);
    expect(par(d, "c_b", ["1", "2"])).toBe(4);
  });

  it("escalar is null for a '.' and undefined for an absent scalar", () => {
    const d = leerDats(["param Z := .;"]);
    expect(escalar(d, "Z")).toBeNull();
    expect(escalar(d, "Y")).toBeUndefined();
  });
});
