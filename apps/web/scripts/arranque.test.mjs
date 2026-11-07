import { describe, expect, it } from "vitest";

import { CODIGO_USO, decidirArranque } from "./arranque.mjs";

const base = { AUTH_URL: "http://127.0.0.1:8870" };

describe("decidirArranque", () => {
  it("without HOST or XPAND_WEB_PORT, dev listens on 127.0.0.1:8870", () => {
    expect(decidirArranque({ modo: "dev", env: {} })).toEqual({
      ok: true,
      host: "127.0.0.1",
      puerto: 8870,
      args: ["dev", "-H", "127.0.0.1", "-p", "8870"],
    });
  });

  it("takes the port from XPAND_WEB_PORT", () => {
    const decision = decidirArranque({ modo: "dev", env: { XPAND_WEB_PORT: "8871" } });
    expect(decision).toMatchObject({ ok: true, puerto: 8871 });
    expect(decision.args).toEqual(["dev", "-H", "127.0.0.1", "-p", "8871"]);
  });

  it.each(["127.0.0.1", "localhost", "::1"])("accepts the local host %s without permission", (host) => {
    expect(decidirArranque({ modo: "dev", env: { HOST: host } })).toMatchObject({ ok: true, host });
  });

  it.each(["0.0.0.0", "192.168.1.10", "::"])("refuses HOST=%s with code 64 unless XPAND_PERMITIR_RED=1", (host) => {
    const decision = decidirArranque({ modo: "dev", env: { HOST: host } });
    expect(decision).toMatchObject({ ok: false, codigo: CODIGO_USO });
    expect(decision.mensaje).toContain("XPAND_PERMITIR_RED=1");

    expect(decidirArranque({ modo: "dev", env: { HOST: host, XPAND_PERMITIR_RED: "1" } })).toMatchObject({
      ok: true,
      host,
    });
  });

  it("XPAND_PERMITIR_RED must be exactly 1", () => {
    expect(decidirArranque({ modo: "dev", env: { HOST: "0.0.0.0", XPAND_PERMITIR_RED: "true" } })).toMatchObject({
      ok: false,
      codigo: CODIGO_USO,
    });
  });

  it.each(["abc", "0", "70000", "80.5", ""])("refuses an invalid port (%s) with code 64", (puerto) => {
    const decision = decidirArranque({ modo: "dev", env: { XPAND_WEB_PORT: puerto, ...base } });
    if (puerto === "") {
      expect(decision).toMatchObject({ ok: true, puerto: 8870 });
      return;
    }
    expect(decision).toMatchObject({ ok: false, codigo: CODIGO_USO });
    expect(decision.mensaje).toContain("XPAND_WEB_PORT");
  });

  it("refuses an unknown mode with code 64", () => {
    expect(decidirArranque({ modo: "build", env: base })).toMatchObject({ ok: false, codigo: CODIGO_USO });
    expect(decidirArranque({ modo: undefined, env: base })).toMatchObject({ ok: false, codigo: CODIGO_USO });
  });

  it("start (production server) requires AUTH_URL", () => {
    const sinAuthUrl = decidirArranque({ modo: "start", env: {} });
    expect(sinAuthUrl).toMatchObject({ ok: false, codigo: CODIGO_USO });
    expect(sinAuthUrl.mensaje).toContain("AUTH_URL");

    expect(decidirArranque({ modo: "start", env: base })).toMatchObject({
      ok: true,
      args: ["start", "-H", "127.0.0.1", "-p", "8870"],
    });
  });
});
