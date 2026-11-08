# Fixtures compartidos Julia ↔ TypeScript

Pares de entrada y salida esperada que ambas suites leen. El formato del
JSON neutro está en `specs/002-port-lectores-ts/contracts/neutral-format.md`.

## Estructura

```
contracts/fixtures/
├── manifest.json            # fuente y MD5 de cada entrada
├── <lector>/<caso>/input.*  # entrada (.dat, .m o .txt)
├── <lector>/<caso>/expected.json
└── <lector>/<caso>/LICENSE-*  # aviso de licencia, si la entrada es de terceros
```

- `<lector>` es `ampl`, `plan` o `matpower`.
- `manifest.json` tiene una entrada por fixture, con clave `<lector>/<caso>`,
  `fuente` (URL exacta con tag o commit, o `sintetico, escrito para la prueba`),
  `md5` (del `input`) y, si aplica, `licencia`.

## Extensión de la 003 (Red)

La feature 003 amplía el formato neutro para Red sin reescribir la 002 (decisión D2,
2026-10-23): `nothing` → `null`; `Set` → lista ascendente; `NaN`, `Inf` y `-Inf` →
`{"nonfinite":"NaN"}`, `{"nonfinite":"Inf"}`, `{"nonfinite":"-Inf"}`. Los fixtures de
Red viven en `red/<esquema>/<caso>/` y su contrato está en
`specs/003-port-red-ts/contracts/red-format.md`. Los `expected.json` de la 002 no
cambian con esta ampliación (se verifica con `git diff --exit-code`).

## Procedencia

- Los datos de SNI, SDDP (`*.psr`) y CENACE no entran aquí (Principio II).
- No se usa nada de `data/casos/_papelera_*`.
- Los fixtures son archivos normales de Git, no LFS.

## Regla de regeneración

Los `expected.json` salen **solo** de la salida de los lectores Julia, con
`packages/XpandCore/tools/generar_fixtures.jl`. No se editan a mano.

Un `expected.json` solo cambia con una decisión registrada en
`specs/002-port-lectores-ts/spec.md`, con su número. **Nunca** se cambia para
que la suite TypeScript pase: si TS no coincide, se corrige TS.

## Quién los consume

- Julia: `packages/XpandCore/test/fixtures_test.jl` regenera la salida en
  memoria y la compara con el `expected.json` versionado.
- TypeScript: `platform/packages/core/src/fixtures.test.ts` compara la salida
  de cada lector con el mismo archivo.

## Exclusión de imágenes

Este directorio no entra en las imágenes `web` ni `orchestrator`
(`.dockerignore` y `platform/scripts/check-image-contents.sh`, FR-016).
