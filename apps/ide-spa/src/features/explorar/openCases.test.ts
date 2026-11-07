import { describe, expect, it } from "vitest";
import { caseKey, upsertOpenCase, withoutOpenCase, type OpenCase } from "./openCases";

const GARVER: OpenCase = { key: caseKey("jump_misocp", "tnep_garver6"), engineId: "jump_misocp", systemId: "tnep_garver6", title: "Garver 6" };
const OTHER: OpenCase = { key: caseKey("fp_dc", "sni"), engineId: "fp_dc", systemId: "sni", title: "SNI" };

describe("upsertOpenCase", () => {
  it("adds a case that is not open yet, after the ones already open", () => {
    expect(upsertOpenCase([GARVER], OTHER)).toEqual([GARVER, OTHER]);
  });

  it("returns the same list when nothing changes, so that no render follows", () => {
    const list = [GARVER, OTHER];
    expect(upsertOpenCase(list, { ...GARVER })).toBe(list);
  });

  it("updates the title of a case when its name becomes known", () => {
    const named = { ...GARVER, title: "Garver 6 — benchmark" };
    expect(upsertOpenCase([{ ...GARVER, title: "tnep_garver6" }], named)).toEqual([named]);
  });
});

describe("withoutOpenCase", () => {
  it("removes the case with that key and keeps the others in order", () => {
    expect(withoutOpenCase([GARVER, OTHER], GARVER.key)).toEqual([OTHER]);
  });

  it("returns the same list when the key is not open", () => {
    const list = [GARVER];
    expect(withoutOpenCase(list, "missing")).toBe(list);
  });
});
