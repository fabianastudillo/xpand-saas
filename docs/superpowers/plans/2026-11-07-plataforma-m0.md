# Plataforma XPAND · M0 (servidor local con casos públicos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la interfaz de M0 funcione servida por un servidor TS propio de xpand-saas, con catálogo y red leídos de un almacén de casos públicos, sin el servidor Julia y sin tocar xpand.

**Architecture:** `apps/server` (Fastify) sirve la SPA (`apps/web`, antes `apps/local`) en `/` y la API de solo lectura en `/api`. Las redes se construyen con los lectores TS de la 003 (`packages/core`) a partir de un almacén de casos en disco (carpeta por caso + `manifiesto.json`). Un importador llena el almacén desde un checkout de xpand (solo lectura) y un comparador contrasta la API con un servidor xpand en marcha.

**Tech Stack:** pnpm, TypeScript ~5.9.3 estricto, Node ≥ 22, Fastify 5, ajv 8 (draft-07), Vitest, Playwright 1.65.0 + axe, esbuild (empaquetado del servidor), React/Vite/TanStack Query (de M0).

**Spec:** `docs/superpowers/specs/2026-11-07-plataforma-xpand-saas-design.md` (aprobado 2026-11-07). Rama de trabajo: `fabian/m0` de xpand-saas (la interfaz de M0 ya está ahí).

## Global Constraints

- xpand **no se modifica**: ni commits, ni ficheros escritos en ningún checkout de xpand. Solo se leen.
- Los datos SNI/CENACE/SDDP **nunca** entran en el repo, fixtures, capturas, registros ni respuestas anónimas.
- Un sistema es `publico` solo si figura en la lista blanca `config/casos-publicos.json`; todo lo demás es `interno`. En M0 los `interno` no se sirven nunca.
- El almacén vive fuera del repo por defecto (`XPAND_ALMACEN`, por defecto `~/.xpand-saas/almacen`); `.gitignore` excluye `almacen/` en cualquier nivel.
- El servidor escucha en `127.0.0.1` por defecto y **se niega** a arrancar en otra dirección salvo con `XPAND_PERMITIR_RED=1` (M0 no tiene autenticación).
- `contracts/api` es la fuente del contrato; se conservan `nombre` opcional, `etiqueta` requerida, ids y `de`/`a` cadena o entero normalizados en `packages/api` (`normalizeRed`).
- Errores de la API: forma única `{ "error": { "codigo": string, "mensaje": string } }`, sin rutas del disco ni trazas.
- Cifras: comparación exacta con xpand (decisión D1 de la 003); una diferencia es defecto de la plataforma, nunca se ajustan datos.
- Interfaz: se mantienen i18n ES/EN por claves, WCAG 2.2 AA, insignias de honestidad, validación de esquema también en producción, solo `.woff2`.
- Commits en español (qué y por qué), terminando en `Claude-Session: https://claude.ai/code/session_01L1At4RTFpiGYnqJHx7E9ZJ`. Sin push, tags ni PR sin confirmación del usuario.

## Review Focus

1. **Caso interno pedido por URL** (`/api/red?motor=…&sistema=<interno>`): debe responder exactamente igual que un caso inexistente (404 `caso_no_encontrado`), sin oráculo de existencia. → prueba en Task 5.
2. **Parámetros con rutas** (`sistema=../../etc`, `%2e%2e`, separadores, NUL) y enlaces simbólicos dentro del almacén: nunca se lee fuera de la carpeta del caso. → pruebas en Task 3.
3. **Un caso que el lector no puede leer** (fichero truncado o ausente): esa red da 500 `lector_fallo` y el catálogo y los demás casos siguen funcionando. → prueba en Task 5.
4. **Almacén ausente o vacío al arrancar:** el servidor arranca, avisa una vez en el registro con la ruta esperada y la interfaz muestra un catálogo vacío con una entrada en «Problemas» que explica cómo importar. → pruebas en Task 5 y Task 6.
5. **Arranque en `0.0.0.0` por error** (`HOST=0.0.0.0`): sin `XPAND_PERMITIR_RED=1` el proceso sale con código 64 y un mensaje claro. → prueba en Task 5.

---

### Task 1: Desacoplar de xpand: `apps/web`, contrato propio, sin sincronización

**Files:**
- Rename: `apps/local/` → `apps/web/` (paquete `@xpand/web`; actualizar `pnpm-workspace.yaml`, scripts de la raíz, `eslint.config.js`, `vitest.config.js`, CI, README)
- Modify: `apps/web/vite.config.ts` (`base: "/"`; proxy de desarrollo `/api` → `http://127.0.0.1:${XPAND_SERVER_PORT ?? 8870}`)
- Modify: `apps/web/src/app/IdeFrame.tsx` y `apps/web/src/i18n/{es,en}.json` (pie «Plataforma X · Interfaz Y»; si X = Y, «Versión X»)
- Delete: `scripts/sync-from-xpand.sh`, `scripts/sync-from-xpand.test.sh`, job `contract` de `.github/workflows/ci.yml`, scripts `sync:contracts`/`check:contracts`
- Modify: `contracts/api/README.md` (ahora es la fuente; quitar toda referencia a xpand como origen)

**Interfaces:**
- Produces: paquete `@xpand/web` con `base: "/"`; variable `XPAND_SERVER_PORT` (por defecto `8870`) usada por el proxy de Vite y por `apps/server` (Task 5).

- [ ] **Step 1:** Actualizar las pruebas unitarias del pie (`uiVersion.test.ts`, `messages.test.ts`) a las claves nuevas: `"Plataforma 0.1.0 · Interfaz 0.2.0"` cuando difieren y `"Versión 0.1.0"` cuando coinciden. Ejecutar `pnpm -r test` → FAIL.
- [ ] **Step 2:** Renombrar, cambiar `base`, proxy, pie y textos; quitar el enlace o mención a la «interfaz clásica» en `apiProblems.ts` (la acción de `auth` queda solo en «Reintentar»).
- [ ] **Step 3:** Borrar la sincronización y el job `contract`; `grep -rn "xpand-gui\|sync-from-xpand\|XPAND_REPO_TOKEN\|XPAND_CONTRACT_REF\|/app/" --exclude-dir=node_modules .` no devuelve nada fuera de `docs/` y `CHANGELOG.md`.
- [ ] **Step 4:** `pnpm lint && pnpm typecheck && pnpm test` → verde. Los e2e se adaptan en Task 6; aquí basta con que compilen (`pnpm --filter @xpand/web exec tsc -p e2e`, o el comando equivalente que use el repo).
- [ ] **Step 5:** Commit «Desacopla la interfaz de xpand: apps/web en /, contrato propio, sin sincronización».

### Task 2: `packages/core` con los lectores de la 003

**Files:**
- Create: `packages/core/` copiado de `platform/packages/core` en el repo `~/Projects/github/TEP/xpand`, ref `personal/003-port-red-ts` (commit `d224586`), con `git show`/`git archive` — **sin** cambiar de rama en ese repo
- Create: `packages/core/fixtures/` con `contracts/fixtures/` de esa misma ref (las pruebas se reapuntan a esta ruta)
- Create: `packages/core/FIXTURES.md` (inventario: cada carpeta de fixture, su origen y por qué es pública o sintética)

**Interfaces:**
- Produces: `@xpand/core` exporta (tal cual vienen) `readAmplDat`, `readPlan`, `readMatpowerTables`, `redMisocp(rutas, leer)`, `redGfmgfl(rutas, leer)`, `redMatpower(texto)`, `redReal(texto)`, `redHidro(etapas, leer)`, `leerSitios`… y los tipos `Leer = (ruta: string) => string | undefined`, `Dict`, `Json`.

- [ ] **Step 1:** Inventario antes de copiar: listar todos los ficheros de `contracts/fixtures` en esa ref y buscar marcas de datos internos (`grep -rliE "sni|cenace|sddp|ecuador|celec|transelectric"`). Cualquier fixture con datos internos **no se copia** y su prueba se marca `skip` con el motivo en `FIXTURES.md`. Escribir el inventario.
- [ ] **Step 2:** Copiar el paquete y los fixtures, ajustar rutas de fixtures, `tsconfig`, ESLint y el `vitest.config.js` de la raíz. No se modifica código de los lectores.
- [ ] **Step 3:** `pnpm --filter @xpand/core test` y `pnpm --filter @xpand/core typecheck` → verde con el mismo número de pruebas que en la ref de origen (menos las marcadas `skip`, si las hay). Anotar ambos números en el commit.
- [ ] **Step 4:** Commit «packages/core: lectores TS de la 003 (d224586) con sus fixtures públicos».

### Task 3: Almacén de casos

**Files:**
- Create: `contracts/almacen/manifiesto.schema.json` + `contracts/almacen/examples/manifiesto.json`
- Create: `apps/server/src/almacen.ts`, `apps/server/src/almacen.test.ts`
- Create: `apps/server/test/almacen/` (almacén de prueba escrito a mano: los ficheros fuente de Garver 6 benchmark `tnep_garver6` de `jump_misocp` y de un sistema público de `fp_dc` — los dos que trae `contracts/api/examples/catalogo.json` —, copiados de `data/casos/` de `/home/fabian/Projects/github/xpand` según el `archivos` del catálogo Julia; un caso `interno` **sintético** con nombres inventados; un caso con un `.dat` truncado)

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces:
  - Manifiesto: `{ motor: {id, nombre, formulacion?, familia?, esquema_red, ...extra}, sistema: {id, nombre, barras, dificultad?, nota?, referencias?, ...extra}, archivos: Record<string, string | string[]>, visibilidad: "publico" | "interno", origen: {repo: string, commit: string, ruta: string} }`. `archivos` usa las mismas claves que el catálogo Julia (`base`, `ac`, `m`, `red`, `horizonte`, `econ`, `tighten`, `nombres`, …) con nombres relativos a la carpeta del caso.
  - `abrirAlmacen(dir: string): Promise<Almacen>`; `Almacen.casos(opts: {incluirInternos: boolean}): Caso[]`; `Almacen.caso(motor: string, sistema: string, opts): Caso | undefined`; `Caso.leer: Leer` (lee solo dentro de la carpeta del caso; devuelve `undefined` si no existe); `Caso.ruta(clave: string): string[]`.
  - Estructura en disco: `<almacen>/<motor>/<sistema>/manifiesto.json` + ficheros.

- [ ] **Step 1: Pruebas** (`almacen.test.ts`): `abrirAlmacen` sobre `test/almacen` lista los dos casos públicos y oculta el interno salvo `incluirInternos: true`; `caso("jump_misocp","tnep_garver6")` devuelve el manifiesto validado; un manifiesto que no cumple el esquema se descarta con un aviso (no rompe el almacén); `caso("..","..")`, `caso("jump_misocp","../fp_dc/x")`, ids con `/`, `\`, `%2e`, NUL → `undefined`; `leer("../../manifiesto.json")` y un enlace simbólico que sale de la carpeta → `undefined`; directorio inexistente → almacén vacío con `aviso` que nombra la ruta.
- [ ] **Step 2:** `pnpm --filter @xpand/server test` → FAIL.
- [ ] **Step 3:** Implementar con ids validados por `^[A-Za-z0-9_.-]+$` (y distinto de `.`/`..`), `realpath` del fichero comparado con el `realpath` de la carpeta del caso, y validación del manifiesto con ajv.
- [ ] **Step 4:** Pruebas → PASS.
- [ ] **Step 5:** Commit «Almacén de casos: manifiesto, visibilidad y lectura confinada a la carpeta del caso».

### Task 4: Construcción de la red para la API

**Files:**
- Create: `apps/server/src/red.ts`, `apps/server/src/red.test.ts`

**Interfaces:**
- Consumes: `Caso` (Task 3), lectores de `@xpand/core` (Task 2).
- Produces: `construirRed(caso: Caso, tec: "ac"): Red` (tipo generado de `contracts/api`), que lanza `LectorError` (`codigo: "lector_fallo"`, mensaje sin rutas absolutas) si el lector falla.

- [ ] **Step 1: Leer la referencia** (solo lectura): `construir_red` en `/home/fabian/Projects/github/xpand/src/servidor.jl` (selección de ficheros por `esquema_red` y por tecnología, overlays `econ`/`tighten`, filtro de candidatos por tecnología, nombres de barra desde el fichero de nombres). Portar **solo** lo necesario para `tec=ac` y los campos que exige `contracts/api/red.schema.json`; anotar en la cabecera de `red.ts` qué partes de `construir_red` no se portan (coordenadas, reserva, tablas por punto, otras tecnologías).
- [ ] **Step 2: Pruebas** (`red.test.ts`): para `tnep_garver6` el resultado valida contra `red.schema.json` y es **igual** (deep equal en los campos del contrato) a `contracts/api/examples/red.json` (Barra 2: `pd` 240, `qd` 72); para el sistema de `fp_dc` del almacén de prueba valida, y su número de barras coincide con `barras` de ese sistema en `contracts/api/examples/catalogo.json` (la paridad completa la da Task 8, que además guarda `esperado-red.json` y lo convierte en prueba); el caso truncado lanza `LectorError` con `codigo: "lector_fallo"`.
- [ ] **Step 3:** Pruebas → FAIL. **Step 4:** Implementar. **Step 5:** Pruebas → PASS.
- [ ] **Step 6:** Commit «Red de un caso para la API a partir de los lectores TS (tec=ac)».

### Task 5: Servidor Fastify

**Files:**
- Create: `apps/server/package.json` (`@xpand/server`, versión `0.1.0`), `apps/server/src/app.ts`, `apps/server/src/main.ts`, `apps/server/src/estaticos.ts`, `apps/server/src/*.test.ts`

**Interfaces:**
- Consumes: `abrirAlmacen`, `construirRed`.
- Produces: `crearApp(opts: { almacen: Almacen; webDist?: string; version: string }): FastifyInstance`; `main.ts` lee `XPAND_ALMACEN`, `XPAND_SERVER_PORT` (8870), `HOST` (127.0.0.1), `XPAND_PERMITIR_RED`, `XPAND_WEB_DIST` (por defecto `../web/dist` relativo al paquete; en el tarball, `./web`).

- [ ] **Step 1: Pruebas** con `app.inject` y el almacén de prueba:
  - `GET /api/catalogo` valida contra `catalogo.schema.json`, contiene los dos públicos y **no** el interno; motores sin sistemas públicos no aparecen.
  - `GET /api/red?motor=jump_misocp&sistema=tnep_garver6&tec=ac` valida contra `red.schema.json`.
  - `GET /api/red` del interno, de uno inexistente y con `sistema=../x` → los tres 404 con el mismo cuerpo `{error:{codigo:"caso_no_encontrado", mensaje}}`.
  - `GET /api/red` del caso truncado → 500 `lector_fallo`; justo después `GET /api/catalogo` → 200.
  - `tec` distinto de `ac` → 400 `tec_no_soportada`.
  - `GET /api/config` → `{version: "0.1.0"}` (valida); `GET /api/sesion` → `{dentro:false, local:true, nombre:"", exigida:false}` (valida).
  - Estáticos: `/` y `/casos/x` → `index.html` con `no-store`; `/assets/a.js` → el fichero con caché inmutable; `/assets/nope.js` → 404; `/%zz`, `/../package.json`, enlace simbólico fuera de `webDist` → 404; todas con `X-Content-Type-Options: nosniff`.
  - Almacén inexistente → la app arranca y `/api/catalogo` devuelve `{motores: []}`.
  - `main` con `HOST=0.0.0.0` sin `XPAND_PERMITIR_RED=1` → sale con 64 y mensaje (probar la función de configuración, no un proceso).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar (catálogo agrupado por motor desde los manifiestos; caché en memoria de catálogo y redes por `motor/sistema/tec`; errores con la forma única; reutilizar las reglas de `servir_app` de la revisión de xpand: decodificar una vez, rechazar `.`/`..`/`\`/`:`/NUL, `realpath`). **Step 4:** PASS.
- [ ] **Step 5:** Commit «Servidor de la plataforma: API de solo lectura y estáticos de la interfaz».

### Task 6: Desarrollo y e2e contra el servidor real

**Files:**
- Modify: `package.json` raíz (`dev` arranca `@xpand/server` en modo vigilancia y Vite a la vez; `start` sirve la build), `apps/web/playwright.config.ts` (`webServer`: build de `apps/web` + `@xpand/server` con `XPAND_ALMACEN=apps/server/test/almacen`), `apps/web/e2e/*.spec.ts`, `apps/web/e2e/mock-api.ts`
- Modify: `apps/web/src/i18n/{es,en}.json` y la vista del catálogo vacío

**Interfaces:**
- Consumes: servidor de Task 5 y almacén de prueba de Task 3.

- [ ] **Step 1:** Reescribir los e2e del camino feliz para que usen el servidor real (sin `page.route`); los estados de error (401, 500, esquema inválido, red caída) siguen con `page.route` sobre el servidor real. Añadir: catálogo vacío (servidor con almacén vacío) → la tabla vacía dice que no hay casos y «Problemas» explica `XPAND_ALMACEN` e `importar-casos`; el caso interno no aparece en la lista; la URL directa del interno muestra «caso no encontrado» con enlace al catálogo.
- [ ] **Step 2:** `CI=1 pnpm e2e` → FAIL donde falta comportamiento. **Step 3:** Implementar el estado vacío y el «caso no encontrado». **Step 4:** `pnpm e2e` local y `CI=1 pnpm e2e` → verde; axe sin violaciones. Regenerar `@visual` si cambian (decirlo en el commit).
- [ ] **Step 5:** Commit «La interfaz se prueba contra el servidor de la plataforma».

### Task 7: Importador de casos

**Files:**
- Create: `scripts/importar-casos.ts` (ejecutado con `node --experimental-strip-types` o `tsx`, el que ya use el repo), `scripts/julia/volcar-catalogo.jl`, `config/casos-publicos.json`, `scripts/importar-casos.test.ts`

**Interfaces:**
- Consumes: esquema del manifiesto (Task 3).
- Produces: `pnpm importar-casos --xpand <checkout> [--almacen <dir>] [--incluir-internos]`. Sin `--incluir-internos` solo importa los de la lista blanca.

- [ ] **Step 1:** `volcar-catalogo.jl` se ejecuta con `julia --project=<checkout> scripts/julia/volcar-catalogo.jl <salida.json>` y escribe, por motor y sistema, los campos públicos del catálogo más `raiz`, `archivos` y `esquema_red`. Carga el paquete del checkout **sin** escribir en él: copia del checkout a un directorio temporal o `JULIA_DEPOT_PATH`/`GTNEP_SALIDAS` apuntando fuera del checkout; comprobar al final que `git -C <checkout> status --porcelain` no cambió.
- [ ] **Step 2: Pruebas** (`importar-casos.test.ts`, con un volcado JSON de prueba y un árbol de ficheros falso, sin Julia): genera un manifiesto válido por caso; copia solo los ficheros de `archivos`; un sistema fuera de la lista blanca no se copia (ni aparece en el almacén); un `archivos` que apunta fuera de `raiz` se rechaza; nunca escribe dentro de `--xpand`; repetir la importación es idempotente (mismo resultado, sin duplicados).
- [ ] **Step 3:** FAIL. **Step 4:** Implementar. **Step 5:** PASS.
- [ ] **Step 6:** `config/casos-publicos.json`: Garver (todas sus variantes de los motores con datos públicos), IEEE 24/118/300, casos MATPOWER de la librería pública y sintéticos. Cada entrada con su fuente pública. Ningún `ecuador*`, `sni*`, `sddp*`, `cenace*`.
- [ ] **Step 7:** Prueba real contra `/home/fabian/Projects/github/xpand` con `--almacen` en el scratchpad: cuántos casos importados, cuántos omitidos, y `git status` de xpand intacto. Anotarlo en el commit.
- [ ] **Step 8:** Commit «Importador de casos desde un checkout de xpand, con lista blanca de casos públicos».

### Task 8: Comparador con xpand

**Files:**
- Create: `scripts/comparar-con-xpand.ts`, `scripts/comparar-con-xpand.test.ts`, `apps/server/test/almacen/<motor>/<sistema>/esperado-red.json` (solo los dos públicos)
- Modify: `apps/server/src/red.test.ts`

**Interfaces:**
- Produces: `pnpm comparar-con-xpand --xpand-url http://127.0.0.1:<p> --plataforma-url http://127.0.0.1:<q> [--guardar-esperado <dir>]`. Exit 0 sin diferencias, 1 con diferencias, 64 uso o servidor inalcanzable.

- [ ] **Step 1: Pruebas** con dos servidores falsos: respuestas iguales → 0; una cifra distinta en `barras[1].pd` → 1 y el informe nombra `motor/sistema`, la ruta JSON y ambos valores; un caso que xpand tiene y la plataforma no (público) → diferencia; un caso interno solo en xpand → **no** se compara ni se nombra en el informe; `--guardar-esperado` escribe `esperado-red.json` solo para casos públicos.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar: compara solo los campos de `contracts/api` (catálogo: motores/sistemas públicos y sus campos del contrato; red: `tec=ac`), números con igualdad exacta, ids normalizados a cadena en ambos lados. **Step 4:** PASS.
- [ ] **Step 5:** Ejecución real: servidor xpand del usuario en el **8850** (solo lectura, no se arranca ni se para) contra la plataforma en el 8870 con el almacén de Task 7. Toda diferencia se lleva al ledger como hallazgo (defecto del adaptador o del lector), no se ajusta el dato. Generar con `--guardar-esperado` los `esperado-red.json` de los dos casos públicos del almacén de prueba y añadir en `apps/server/src/red.test.ts` la igualdad exacta contra ellos.
- [ ] **Step 6:** Commit «Comparador de la API de la plataforma con un servidor xpand».

### Task 9: Release del servidor y documentación

**Files:**
- Modify: `.github/workflows/release.yml`, `scripts/package-dist.sh` (+ prueba), `README.md`, `CHANGELOG.md` (v0.1.0 de la plataforma), `TODO.md`
- Create: `apps/server/build.mjs` (esbuild: `dist/server.mjs` autocontenido)

**Interfaces:**
- Produces: tarball `xpand-plataforma-vX.Y.Z.tar.gz` con `server.mjs`, `web/` (build de `apps/web`), `contracts/`, `config/casos-publicos.json`, `README-instalar.md`; se arranca con `node server.mjs` (Node ≥ 22). Sin casos dentro.

- [ ] **Step 1:** Extender `package-dist.test.sh`: el tarball contiene esas entradas y ninguna más; ningún fichero bajo `almacen/`; sin `.map`, enlaces ni especiales (reglas existentes); el tag debe coincidir con la versión de `apps/server/package.json`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar build y empaquetado; release.yml usa el script nuevo (mantener: acciones fijadas a SHA, `GH_TOKEN` solo al publicar, sin caché de pnpm). **Step 4:** PASS; desempaquetar en el scratchpad, `XPAND_ALMACEN=<almacén de Task 7> node server.mjs` y `curl` a `/`, `/api/catalogo` y una red.
- [ ] **Step 5:** README: qué es, `pnpm dev`, importar casos, comparar con xpand, release, variables de entorno, la regla de casos públicos/internos. CHANGELOG y TODO (lo que la red de la API aún no porta de `construir_red`; portar el catálogo a TS después de M2).
- [ ] **Step 6:** Commit «Release del servidor de la plataforma y documentación de M0».

## Asignación de ejecución (SDD)

| Task | Implementador | Revisión ECC |
|---|---|---|
| 1 | haiku | typescript-reviewer |
| 2 | haiku | code-reviewer (+ comprobación de datos internos) |
| 3 | sonnet | security-reviewer + typescript-reviewer |
| 4 | fable | code-reviewer (paridad con Julia) |
| 5 | sonnet | security-reviewer + typescript-reviewer |
| 6 | sonnet | e2e-runner + react-reviewer |
| 7 | fable | security-reviewer (datos internos, escritura en xpand) |
| 8 | haiku | code-reviewer |
| 9 | haiku | security-reviewer (release) |

Revisión final de rama: fable. Rondas de arreglo 4–5: fable.
