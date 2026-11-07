import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "./en.json";
import es from "./es.json";
import { getLocale, setLocale, t, useLocale, type MessageKey } from "./index";

afterEach(() => {
  setLocale("es");
  vi.unstubAllEnvs();
});

describe("message catalogs", () => {
  it("es.json and en.json have exactly the same keys", () => {
    const esKeys = Object.keys(es).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(esKeys);
  });

  it("every message is a non-empty string", () => {
    for (const catalog of [es, en]) {
      for (const [key, value] of Object.entries(catalog)) {
        expect(typeof value, key).toBe("string");
        expect(value.trim().length, key).toBeGreaterThan(0);
      }
    }
  });

  it("names the honesty badges exactly as the spec does", () => {
    expect(es["status.uncertified"]).toBe("NO CERTIFICADO");
    expect(en["status.uncertified"]).toBe("NOT CERTIFIED");
    expect(es["status.acFeasible"]).toBe("Factible en AC");
  });
});

describe("t()", () => {
  it("starts in Spanish and translates by key", () => {
    expect(getLocale()).toBe("es");
    expect(t("status.uncertified")).toBe("NO CERTIFICADO");
  });

  it("switches language with setLocale", () => {
    setLocale("en");
    expect(t("status.uncertified")).toBe("NOT CERTIFIED");
    expect(t("status.certified")).toBe("Certified");
  });

  it("interpolates {vars} and leaves unknown placeholders visible", () => {
    expect(t("count.items", { n: 6 })).toBe("6 elementos");
    expect(t("count.items", {})).toBe("{n} elementos");
  });

  it("throws on a missing key in development", () => {
    vi.stubEnv("DEV", true);
    const missing = "does.not.exist" as MessageKey;
    expect(() => t(missing)).toThrow(/does\.not\.exist/);
  });

  it("shows the key instead of throwing in production", () => {
    vi.stubEnv("DEV", false);
    const missing = "does.not.exist" as MessageKey;
    expect(t(missing)).toBe("does.not.exist");
  });

  it("rejects an unsupported locale", () => {
    expect(() => {
      setLocale("fr" as never);
    }).toThrow(/locale/i);
    expect(getLocale()).toBe("es");
  });
});

describe("useLocale()", () => {
  it("re-renders when the locale changes", () => {
    const { result } = renderHook(() => useLocale());
    expect(result.current).toBe("es");

    act(() => {
      setLocale("en");
    });

    expect(result.current).toBe("en");
  });
});
