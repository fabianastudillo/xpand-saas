# Plataforma XPAND · M0 (plantilla open-micro-saas + Explorar casos públicos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la plataforma XPAND arranque en local sobre la plantilla open-micro-saas (cuentas, administración) con la zona IDE «Explorar casos» de M0, alimentada por catálogo y red leídos de un almacén de casos públicos, sin el servidor Julia y sin tocar xpand.

**Architecture:** `apps/web` es la app Next de `saas-plantilla`, subida a Next 15/React 19/Tailwind 4. La zona IDE (`/casos…`) monta `packages/ui` y las pantallas de M0 como componentes cliente; las rutas `/api` de casos son *route handlers* que usan `packages/casos` (almacén + construcción de red) sobre los lectores TS de la 003 (`packages/core`). Un importador llena el almacén desde un checkout de xpand (solo lectura) y un comparador contrasta la API con un servidor xpand en marcha.

**Tech Stack:** pnpm, TypeScript ~5.9.3 estricto, Node ≥ 22, Next 15 (app router), React 19, Tailwind 4, next-auth v5, Prisma 5 + Postgres 16 (docker compose), ajv 8 (draft-07), Vitest, Playwright 1.65.0 + axe, TanStack Query v5.

**Spec:** `docs/superpowers/specs/2026-11-07-plataforma-xpand-saas-design.md` (aprobado y enmendado 2026-11-07, P7). Rama: `fabian/m0` de xpand-saas. La Tarea 1 de la versión anterior de este plan ya está hecha (`15d4ba6`: `apps/local` → `apps/web` Vite en `/`, contrato propio, sin sincronización con xpand) y es el punto de partida.

## Global Constraints

- xpand **no se modifica**: ni commits, ni ficheros escritos en ningún checkout de xpand. Solo se leen.
- Los datos SNI/CENACE/SDDP **nunca** entran en el repo, fixtures, capturas, registros ni respuestas anónimas.
- Un sistema es `publico` solo si figura en la lista blanca `config/casos-publicos.json`; todo lo demás es `interno`. En M0 los `interno` no se sirven nunca.
- El almacén vive fuera del repo por defecto (`XPAND_ALMACEN`, por defecto `~/.xpand-saas/almacen`); `.gitignore` excluye `almacen/` en cualquier nivel.
- La plantilla se copia con `git archive 43e65a1` de `~/Projects/github/saas-plantilla` (solo ficheros versionados). **Nunca** se copia un `.env` ni un secreto; los valores de prueba (`NEXTAUTH_SECRET` de `.env.test`, contraseñas de Postgres de prueba) se regeneran.
- En local, Next escucha en `127.0.0.1` (puerto `XPAND_WEB_PORT`, por defecto `8870`); el arranque en otra dirección exige `XPAND_PERMITIR_RED=1`.
- Pagos (Stripe), analítica y correo saliente quedan apagados sin claves: sin errores, sin enlaces rotos, sin peticiones a terceros.
- `contracts/api` es la fuente del contrato; se conservan `nombre` opcional, `etiqueta` requerida, ids y `de`/`a` cadena o entero normalizados en `packages/api` (`normalizeRed`).
- Errores de las rutas de casos: forma única `{ "error": { "codigo": string, "mensaje": string } }`, sin rutas del disco ni trazas.
- Cifras: comparación exacta con xpand (decisión D1 de la 003); una diferencia es defecto de la plataforma, nunca se ajustan datos.
- Zona IDE: se mantienen i18n ES/EN por claves, WCAG 2.2 AA, insignias de honestidad, validación de esquema también en producción, solo `.woff2`.
- Commits en español (qué y por qué), terminando en `Claude-Session: https://claude.ai/code/session_01L1At4RTFpiGYnqJHx7E9ZJ`. Sin push, tags ni PR sin confirmación del usuario.

## Review Focus

1. **Caso interno pedido por URL** (`/api/red?…&sistema=<interno>` o `/casos/<motor>/<interno>`): responde igual que un caso inexistente (404 `caso_no_encontrado`), con o sin sesión de usuario normal, sin oráculo de existencia. → pruebas en Task 5 y Task 6.
2. **Parámetros con rutas** (`sistema=../../etc`, `%2e%2e`, separadores, NUL) y enlaces simbólicos dentro del almacén: nunca se lee fuera de la carpeta del caso. → pruebas en Task 3.
3. **Un caso que el lector no puede leer** (fichero truncado o ausente): esa red da 500 `lector_fallo` y el catálogo y los demás casos siguen funcionando. → prueba en Task 5.
4. **Almacén ausente o vacío, o Postgres caído, al arrancar:** la zona IDE muestra catálogo vacío con una entrada en «Problemas» que explica cómo importar; sin Postgres, las páginas de cuentas dan un error comprensible y la zona IDE pública sigue mostrando los casos. → pruebas en Task 5 y Task 6.
5. **Plantilla sin claves de terceros** (Stripe, Google, correo vacíos): toda página pública y de cuenta carga sin errores de consola ni peticiones externas. → prueba en Task 2.

---

### Task 2: Plantilla open-micro-saas en `apps/web`, subida de versiones

**Files:**
- Move: el `apps/web` actual (SPA Vite de M0) → `apps/ide-spa` (`git mv`; paquete `@xpand/ide-spa`), para que conviva hasta Task 6
- Create: `apps/web/` con `git archive 43e65a1` de `~/Projects/github/saas-plantilla`, convertido de npm a pnpm (sin `package-lock.json`), paquete `@xpand/web`
- Modify: raíz (`pnpm-workspace.yaml`, scripts, ESLint, CI) para incluir `@xpand/web` y `@xpand/ide-spa`
- Create: `apps/web/.env.example` revisado (todas las claves vacías salvo las locales), `apps/web/.env.test` con valores de prueba **regenerados**

**Interfaces:**
- Produces: app Next en `apps/web` (`src/app/(public|user|admin)`, `src/libs/auth`, `prisma/`), comando `pnpm --filter @xpand/web dev` en `127.0.0.1:8870`, `pnpm db:start` (docker compose de la plantilla), `pnpm --filter @xpand/web e2e` (Playwright de la plantilla).

- [ ] **Step 1:** Copiar la plantilla tal cual (sin subir versiones), integrarla en el workspace y dejar en verde su build y sus pruebas Playwright con Postgres de prueba (`test:db:start`, `test:db:prepare`). Anotar el número de pruebas. Commit «apps/web: plantilla open-micro-saas (saas-plantilla 43e65a1)».
- [ ] **Step 2:** Prueba nueva `tests/unauthenticated/sin-terceros.spec.ts`: con Stripe/Google/correo vacíos, `/`, `/pricing`, `/privacy`, `/terms` y la página de entrada cargan sin errores de consola y sin peticiones a hosts distintos de `127.0.0.1`. Ejecutar → anotar si falla y por qué.
- [ ] **Step 3:** Subir a Next 15, React 19, Tailwind 4 (con su herramienta oficial de migración), `@auth/prisma-adapter` y next-auth v5 compatibles; mantener Prisma 5 salvo que la subida lo exija. Corregir lo que rompa. Apagar sin claves lo que haga falta para que Step 2 pase.
- [ ] **Step 4:** Build + todas las pruebas de la plantilla + `sin-terceros` → verde, mismo número que en Step 1 más la nueva. `pnpm lint && pnpm typecheck && pnpm test` de la raíz → verde (la SPA en `apps/ide-spa` sigue pasando).
- [ ] **Step 5:** `next dev`/`next start` con `-H 127.0.0.1 -p ${XPAND_WEB_PORT:-8870}`; un `HOST` no local sin `XPAND_PERMITIR_RED=1` aborta con código 64 (script de arranque probado con una prueba unitaria de la función que decide).
- [ ] **Step 6:** Commit «apps/web: plantilla en Next 15, React 19 y Tailwind 4; terceros apagados sin claves».

### Task 3: `packages/core` con los lectores de la 003

**Files:**
- Create: `packages/core/` desde `platform/packages/core` de `~/Projects/github/TEP/xpand`, ref `personal/003-port-red-ts` (commit `d224586`), con `git show`/`git archive` — **sin** cambiar de rama en ese repo
- Create: `packages/core/fixtures/` desde `contracts/fixtures/` de esa ref (pruebas reapuntadas) y `packages/core/FIXTURES.md` (inventario: origen y por qué cada carpeta es pública o sintética)

**Interfaces:**
- Produces: `@xpand/core` exporta tal cual `readAmplDat`, `readPlan`, `readMatpowerTables`, `redMisocp(rutas, leer)`, `redGfmgfl(rutas, leer)`, `redMatpower(texto)`, `redReal(texto)`, `redHidro(etapas, leer)`, `leerSitios`… y los tipos `Leer = (ruta: string) => string | undefined`, `Dict`, `Json`.

- [ ] **Step 1:** Inventario antes de copiar: listar los fixtures y buscar datos internos (`grep -rliE "sni|cenace|sddp|ecuador|celec|transelectric"`). Lo interno **no se copia** y su prueba se marca `skip` con el motivo en `FIXTURES.md`.
- [ ] **Step 2:** Copiar paquete y fixtures; `tsconfig`, Vitest de la raíz y ESLint (si el lint falla en código copiado: override limitado a `packages/core` y a esas reglas, sin tocar los lectores).
- [ ] **Step 3:** `pnpm --filter @xpand/core test` y `typecheck` → verde con el mismo número de pruebas que en la ref (menos las `skip`). Anotar ambos números.
- [ ] **Step 4:** Commit «packages/core: lectores TS de la 003 (d224586) con sus fixtures públicos».

### Task 4: Almacén de casos (`packages/casos`)

**Files:**
- Create: `contracts/almacen/manifiesto.schema.json` + `contracts/almacen/examples/manifiesto.json`
- Create: `packages/casos/` (Node, sin dependencias de Next): `src/almacen.ts`, `src/almacen.test.ts`
- Create: `packages/casos/test/almacen/` (almacén de prueba escrito a mano: los ficheros fuente de Garver 6 benchmark `tnep_garver6` de `jump_misocp` y de un sistema público de `fp_dc` — los dos de `contracts/api/examples/catalogo.json` —, copiados de `data/casos/` de `/home/fabian/Projects/github/xpand` según el `archivos` del catálogo Julia; un caso `interno` **sintético** con nombres inventados; un caso con un `.dat` truncado)

**Interfaces:**
- Produces:
  - Manifiesto: `{ motor: {id, nombre, formulacion?, familia?, esquema_red, ...extra}, sistema: {id, nombre, barras, dificultad?, nota?, referencias?, ...extra}, archivos: Record<string, string | string[]>, visibilidad: "publico" | "interno", origen: {repo: string, commit: string, ruta: string} }`. `archivos` usa las claves del catálogo Julia (`base`, `ac`, `m`, `red`, `horizonte`, `econ`, `tighten`, `nombres`, …) con nombres relativos a la carpeta del caso.
  - `abrirAlmacen(dir: string): Promise<Almacen>`; `Almacen.aviso?: string`; `Almacen.casos(opts: {incluirInternos: boolean}): Caso[]`; `Almacen.caso(motor: string, sistema: string, opts): Caso | undefined`; `Caso.manifiesto`; `Caso.leer: Leer` (solo dentro de la carpeta del caso; `undefined` si no existe); `Caso.ruta(clave: string): string[]`.
  - En disco: `<almacen>/<motor>/<sistema>/manifiesto.json` + ficheros.

- [ ] **Step 1: Pruebas**: lista los dos públicos y oculta el interno salvo `incluirInternos: true`; `caso("jump_misocp","tnep_garver6")` devuelve el manifiesto validado; un manifiesto inválido se descarta con aviso sin romper el almacén; `caso("..","..")`, `caso("jump_misocp","../fp_dc/x")`, ids con `/`, `\`, `%2e`, NUL → `undefined`; `leer("../../manifiesto.json")` y un enlace simbólico que sale de la carpeta → `undefined`; directorio inexistente → almacén vacío con `aviso` que nombra la ruta.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar (ids `^[A-Za-z0-9_.-]+$` y distintos de `.`/`..`; `realpath` del fichero contra el de la carpeta; ajv para el manifiesto). **Step 4:** PASS.
- [ ] **Step 5:** Commit «Almacén de casos: manifiesto, visibilidad y lectura confinada a la carpeta del caso».

### Task 5: Red del caso y rutas `/api` de casos

**Files:**
- Create: `packages/casos/src/red.ts`, `packages/casos/src/red.test.ts`
- Create: `apps/web/src/app/api/{catalogo,red,config,sesion}/route.ts`, `apps/web/src/server/casos.ts` (instancia del almacén y cachés), `apps/web/src/server/*.test.ts`

**Interfaces:**
- Consumes: `Caso`/`Almacen` (Task 4), lectores (Task 3), sesión de next-auth (Task 2).
- Produces: `construirRed(caso: Caso, tec: "ac"): Red` (tipo de `contracts/api`), que lanza `LectorError` (`codigo: "lector_fallo"`, sin rutas absolutas). Rutas: `GET /api/catalogo`, `GET /api/red?motor&sistema&tec`, `GET /api/config` → `{version}` (de `apps/web/package.json`), `GET /api/sesion` → `{dentro, local, nombre, exigida:false}` desde la sesión (`dentro:false, nombre:""` sin sesión; `local:true` cuando la petición llega por `127.0.0.1`).

- [ ] **Step 1: Leer la referencia** (solo lectura): `construir_red` en `/home/fabian/Projects/github/xpand/src/servidor.jl` (ficheros por `esquema_red` y tecnología, overlays `econ`/`tighten`, filtro de candidatos, nombres de barra). Portar **solo** lo necesario para `tec=ac` y los campos de `contracts/api/red.schema.json`; la cabecera de `red.ts` lista lo que no se porta.
- [ ] **Step 2: Pruebas de `red.ts`**: `tnep_garver6` valida contra `red.schema.json` y es igual, en los campos del contrato, a `contracts/api/examples/red.json` (Barra 2: `pd` 240, `qd` 72); el sistema de `fp_dc` valida y su número de barras es el de `catalogo.json`; el caso truncado lanza `LectorError`.
- [ ] **Step 3: Pruebas de rutas** (invocando los handlers con `Request`): catálogo valida, trae los dos públicos y no el interno (también con sesión de usuario normal); red de Garver valida; red del interno, de uno inexistente y con `sistema=../x` → mismo 404 `caso_no_encontrado`; caso truncado → 500 `lector_fallo` y el catálogo sigue en 200; `tec≠ac` → 400 `tec_no_soportada`; `config` y `sesion` validan; almacén inexistente → `{motores: []}`.
- [ ] **Step 4:** FAIL. **Step 5:** Implementar (catálogo agrupado por motor desde los manifiestos; caché en memoria por `motor/sistema/tec`; runtime Node). **Step 6:** PASS.
- [ ] **Step 7:** Commit «Red del caso desde los lectores TS y rutas /api de casos en la app Next».

### Task 6: Zona IDE «Explorar casos» en Next y retirada de la SPA

**Files:**
- Create: `apps/web/src/app/(ide)/layout.tsx`, `apps/web/src/app/(ide)/casos/page.tsx`, `apps/web/src/app/(ide)/casos/[motor]/[sistema]/page.tsx`, `apps/web/src/ide/**` (pantallas, i18n y glue trasladados desde `apps/ide-spa/src`)
- Move: e2e de `apps/ide-spa/e2e` → `apps/web/tests/ide/` (Playwright de la app)
- Delete: `apps/ide-spa/` al final, cuando todo pase

**Interfaces:**
- Consumes: rutas `/api` (Task 5), `@xpand/ui`, `@xpand/api` (con `validate` en producción, R17 de la M0 anterior).
- Produces: URLs `/casos` y `/casos/<motor>/<sistema>`; navegación pública con enlace a la zona IDE; pie «Plataforma X · Interfaz Y».

- [ ] **Step 1:** Trasladar los e2e de la SPA a la app Next, con el camino feliz contra la app real y el almacén de prueba (`XPAND_ALMACEN=packages/casos/test/almacen`) y los errores (401, 500, esquema inválido, red caída) con `page.route`. Añadir: catálogo vacío → «Problemas» explica `XPAND_ALMACEN` e `importar-casos`; el interno no aparece; su URL directa muestra «caso no encontrado» con enlace al catálogo; Postgres caído → `/casos` sigue mostrando los públicos; flujo completo solo con teclado (incluido el de pestañas con `activationMode="manual"`) y axe sin violaciones.
- [ ] **Step 2:** FAIL. **Step 3:** Montar el armazón de `packages/ui` como componentes cliente; sustituir React Router por el enrutado de Next conservando foco y estado en la URL; QueryClient en un provider cliente. **Step 4:** PASS en local y con `CI=1`; capturas `@visual` regeneradas (decirlo).
- [ ] **Step 5:** Borrar `apps/ide-spa` y sus referencias; `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` → verde.
- [ ] **Step 6:** Commit «Zona IDE de Explorar casos en la app Next; se retira la SPA Vite».

### Task 7: Importador de casos

**Files:**
- Create: `scripts/importar-casos.ts`, `scripts/julia/volcar-catalogo.jl`, `config/casos-publicos.json`, `scripts/importar-casos.test.ts`

**Interfaces:**
- Consumes: esquema del manifiesto (Task 4).
- Produces: `pnpm importar-casos --xpand <checkout> [--almacen <dir>] [--incluir-internos]`. Sin `--incluir-internos` solo importa los de la lista blanca.

- [ ] **Step 1:** `volcar-catalogo.jl` (`julia --project=<checkout> scripts/julia/volcar-catalogo.jl <salida.json>`) escribe, por motor y sistema, los campos públicos del catálogo más `raiz`, `archivos` y `esquema_red`. Corre con `GTNEP_SALIDAS` y temporales en el scratchpad; se comprueba `git -C <checkout> status --porcelain --ignored` antes y después: idéntico.
- [ ] **Step 2: Pruebas** (volcado JSON de prueba y árbol falso, sin Julia): un manifiesto válido por caso; copia solo los ficheros de `archivos`; un sistema fuera de la lista blanca no se copia ni aparece; un `archivos` fuera de `raiz` se rechaza; nunca escribe dentro de `--xpand`; reimportar es idempotente.
- [ ] **Step 3:** FAIL. **Step 4:** Implementar. **Step 5:** PASS.
- [ ] **Step 6:** `config/casos-publicos.json`: Garver (variantes con datos públicos), IEEE 24/118/300, librería MATPOWER pública y sintéticos, cada uno con su fuente pública. Ningún `ecuador*`, `sni*`, `sddp*`, `cenace*`.
- [ ] **Step 7:** Prueba real contra `/home/fabian/Projects/github/xpand` con `--almacen` en el scratchpad: importados, omitidos y `git status` de xpand intacto, en el commit.
- [ ] **Step 8:** Commit «Importador de casos desde un checkout de xpand, con lista blanca de casos públicos».

### Task 8: Comparador con xpand

**Files:**
- Create: `scripts/comparar-con-xpand.ts`, `scripts/comparar-con-xpand.test.ts`, `packages/casos/test/almacen/<motor>/<sistema>/esperado-red.json` (solo los dos públicos)
- Modify: `packages/casos/src/red.test.ts`

**Interfaces:**
- Produces: `pnpm comparar-con-xpand --xpand-url http://127.0.0.1:<p> --plataforma-url http://127.0.0.1:<q> [--guardar-esperado <dir>]`. Exit 0 sin diferencias, 1 con diferencias, 64 uso o servidor inalcanzable.

- [ ] **Step 1: Pruebas** con dos servidores falsos: iguales → 0; una cifra distinta en `barras[1].pd` → 1 y el informe nombra `motor/sistema`, la ruta JSON y ambos valores; un público que falta en la plataforma → diferencia; un interno solo en xpand → ni se compara ni se nombra; `--guardar-esperado` solo escribe públicos.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar (solo campos de `contracts/api`; red con `tec=ac`; igualdad exacta; ids normalizados a cadena en ambos lados). **Step 4:** PASS.
- [ ] **Step 5:** Ejecución real: xpand del usuario en el **8850** (solo lectura; si no responde, arrancar xpand desde `/home/fabian/Projects/github/xpand` en el 8861 con `GTNEP_SALIDAS` en el scratchpad y pararlo al acabar) contra la plataforma en el 8870 con el almacén de Task 7. Toda diferencia es un hallazgo para el ledger, no un ajuste de datos. Guardar los `esperado-red.json` de los dos públicos de prueba y añadir en `red.test.ts` la igualdad exacta contra ellos.
- [ ] **Step 6:** Commit «Comparador de la API de la plataforma con un servidor xpand».

### Task 9: Release y documentación

**Files:**
- Modify: `.github/workflows/release.yml`, `.github/workflows/ci.yml` (Postgres de servicio para las pruebas de la plantilla), `scripts/package-dist.sh` (+ prueba), `README.md`, `CHANGELOG.md`, `TODO.md`
- Modify: `apps/web/next.config.*` (`output: "standalone"`)

**Interfaces:**
- Produces: tarball `xpand-plataforma-vX.Y.Z.tar.gz` con la salida `standalone`, `.next/static`, `public/`, `prisma/` (esquema y migraciones), `contracts/`, `config/casos-publicos.json`, `README-instalar.md`; se arranca con `node server.js` tras `prisma migrate deploy`. Sin casos ni `.env` dentro.

- [ ] **Step 1:** Extender `package-dist.test.sh`: contiene esas entradas y ninguna más; nada bajo `almacen/`, ningún `.env*`; sin `.map`, enlaces ni especiales; el tag coincide con la versión de `apps/web/package.json`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar; `release.yml` mantiene acciones fijadas a SHA, `GH_TOKEN` solo al publicar y sin caché de pnpm. **Step 4:** PASS; desempaquetar en el scratchpad con un Postgres local, migrar, `XPAND_ALMACEN=<almacén de Task 7> node server.js` y `curl` a `/`, `/casos`, `/api/catalogo` y una red.
- [ ] **Step 5:** README (qué es, base open-micro-saas y de dónde viene, `pnpm dev` con Postgres, primer administrador, importar casos, comparar con xpand, release, variables, regla de casos públicos/internos), CHANGELOG y TODO (lo que `construir_red` aún no porta; traducir las páginas de la plantilla en M1; catálogo a TS después de M2).
- [ ] **Step 6:** Commit «Release de la plataforma y documentación de M0».

## Asignación de ejecución (SDD)

| Task | Implementador | Revisión ECC |
|---|---|---|
| 2 | opus | typescript-reviewer + security-reviewer (auth, secretos, terceros) |
| 3 | haiku | code-reviewer (+ comprobación de datos internos) |
| 4 | sonnet | security-reviewer + typescript-reviewer |
| 5 | opus | code-reviewer (paridad con Julia) + security-reviewer |
| 6 | sonnet | e2e-runner + react-reviewer |
| 7 | opus | security-reviewer (datos internos, escritura en xpand) |
| 8 | haiku | code-reviewer |
| 9 | sonnet | security-reviewer (release) |

Revisión final de rama: opus. Rondas de arreglo 4–5: opus.
