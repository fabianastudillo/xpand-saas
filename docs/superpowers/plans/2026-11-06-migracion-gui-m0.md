> **Histórico.** Copia literal del commit `b4c853f` de xpand (rama `fabian/plan-migracion-gui`, nunca publicada y
> borrada el 2026-11-07). Sustituido por `2026-11-07-plataforma-xpand-saas-design.md` y `2026-11-07-plataforma-m0.md`;
> se guarda porque el spec vigente toma de él las decisiones de interfaz y remite a sus §3.2 y §5.3. No se ejecuta.

# M0 · Fundaciones de la GUI nueva y «Explorar casos». Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: superpowers:subagent-driven-development (recomendada) o
> superpowers:executing-plans, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** un investigador abre `http://127.0.0.1:8850/app/` en su máquina y navega el catálogo y los casos
con la interfaz nueva (IDE refinado, estilo técnico claro), en solo lectura, servida por el servidor Julia actual.

**Arquitectura:**
- La interfaz es un SPA estático (Vite + React) del repo `xpand-saas`. Habla con la API Julia de `xpand` a
  través de un contrato JSON Schema cuya fuente es `xpand/contracts/api/`.
- El build se commitea en `xpand/web/app/`, fijado por versión y sha256, y lo sirve el propio servidor Julia.

**Stack:** Julia 1.12 + HTTP.jl (servidor existente); pnpm 12.14.0, Node 22, TypeScript estricto, React 19,
Vite, React Router, TanStack Query v5, Tailwind 4.1, shadcn/ui (reestilizado), IBM Plex por `@fontsource`,
Vitest 5, Playwright, axe-core.

**Spec:** `docs/superpowers/specs/2026-11-06-migracion-gui-design.md` (§3 arquitectura y estilo; §5 M0).

## Restricciones globales

- **Código** (identificadores, comentarios de API) en inglés. **Commits** en español: qué y por qué. **Textos de
  interfaz** por claves i18n, ES y EN.
- **Repos:** `xpand` es `XPAND-PLEXSYS/xpand`, rama `fabian/gui-m0` desde `origin/main`. Nunca se commitea en
  `main` y se integra por PR. `xpand-saas` es `fabianastudillo/xpand-saas`, rama `main`, con PR por tarea o grupo
  de tareas.
- **Nada de datos internos** (SDDP, CENACE, `data/casos/usuario`) en `xpand-saas`, fixtures, capturas ni builds.
  Los ejemplos del contrato salen de **Garver 6**.
- **Honestidad de resultados:** las insignias *NO CERTIFICADO* / *factible en AC* nunca se ocultan ni se suavizan
  (spec §3.4).
- **Sin red en tiempo de ejecución:** las fuentes y todos los recursos van en el build. No se usan CDN.
- **Presupuesto:** ≤ 300 kB de JS comprimido (gzip) en la ruta inicial. WCAG AA (axe sin violaciones).
- **Solo lectura:** M0 no llama a ninguna ruta que escriba.
- **Rutas de M0:** `GET /api/catalogo`, `GET /api/red?motor=&sistema=&tec=`, `GET /api/config`,
  `GET /api/sesion`.
- **Ejecución:** las tareas de `xpand` y las de `xpand-saas` son independientes hasta la Tarea 9, que las une.
- **Revisión ECC por tarea (obligatoria antes de dar la tarea por cerrada):**

  | Tareas | Agentes |
  |---|---|
  | 2 y 5 | `tdd-guide` **antes** de escribir código (pruebas primero) |
  | 4 a 8 | `typescript-reviewer` |
  | 6 a 8 | `react-reviewer` |
  | 6 y 7 | `a11y-architect` |
  | 8 | `e2e-runner` |
  | 1, 3, 4 y 9 | `security-reviewer` |
  | Al final | `code-reviewer` sobre la rama completa de cada repo |

  Se corrigen los CRITICAL y los HIGH antes de seguir.

## Review Focus

1. **Catálogo lento y pesado (4,1 MB, ~5 s):**
   - mientras carga, la interfaz muestra un esqueleto y sigue respondiendo;
   - la lista de sistemas (~254 por motor) y el árbol de un caso grande (SNI, 938 barras) van virtualizados.
   - Pruebas en las Tareas 7 y 8.
2. **Sin sesión o con la sesión caducada:** si `/api/*` responde 401/403, «Problemas» lo explica y enlaza a la
   GUI clásica para entrar. No se queda una pantalla en blanco. Pruebas en las Tareas 5 y 8.
3. **El servidor se reinicia o cae a mitad de sesión:** el error va a «Problemas» con un botón «Reintentar»; no
   hay sondeo infinito. Pruebas en las Tareas 5 y 8.
4. **Nombres con tildes, ñ, espacios y `/`** en motores y sistemas: se codifican en la URL y en la consulta, y la
   ida y vuelta conserva el identificador. Cifras con coma decimal en ES y punto en EN. Pruebas en las Tareas 5
   y 7.
5. **Respaldo de la SPA:**
   - `/app/<ruta>` sin extensión devuelve `index.html`;
   - `/app/assets/falta.js` devuelve **404**, no `index.html` (si no, el navegador lo leería como HTML y fallaría
     el tipo MIME);
   - nada fuera de `web/app/` es accesible.
   - Pruebas en la Tarea 1.

---

### Tarea 1 · xpand: servir `/app/` con respaldo de SPA

**Archivos:**
- Modificar `src/servidor.jl`: `MIME_POR_EXT` (línea ~328), `servir_estatico` (~334) y el router (~7611-7616).
- Pruebas: `test/runtests.jl`, nuevo testset «interfaz nueva en /app/».

**Interfaces:**
- Produce `servir_app(ruta::AbstractString)::HTTP.Response`.
- Las rutas que empiezan por `/app` (`/app`, `/app/`, `/app/...`) van a `servir_app` antes del respaldo
  estático general.

- [ ] **Paso 1: pruebas que fallan.** En un `mktempdir` que hace de `web/`, con `app/index.html` y
  `app/assets/a-1234.js`:
  - `/app` y `/app/` → 200 con `index.html`;
  - `/app/casos/garver6` → 200 con `index.html`;
  - `/app/assets/a-1234.js` → 200 con `Content-Type: text/javascript; charset=utf-8` y
    `Cache-Control: public, max-age=31536000, immutable`;
  - `/app/assets/falta.js` → 404;
  - `/app/../index.html` y `/app/%2e%2e/servidor.jl` → 404;
  - `/app/index.html` → `Cache-Control: no-store`.

  Usa el mismo mecanismo con el que las pruebas ya fijan `Config.dir_web()`. Si no existe, añade un argumento
  `web = Config.dir_web()` a `servir_app` para inyectarlo.
- [ ] **Paso 2:** `julia --project=. -e 'using Pkg; Pkg.test()'` → FALLA el testset nuevo.
- [ ] **Paso 3: implementación.**
  - Ampliar `MIME_POR_EXT` con `.json`, `.map`, `.woff2`, `.png`, `.webp`.
  - En `servir_app`:
    - una ruta cuyo último segmento tiene extensión se sirve como archivo, o 404 si no existe;
    - una ruta sin extensión devuelve `app/index.html`;
    - los archivos bajo `app/assets/` llevan caché inmutable; el resto, `no-store`;
    - se reutiliza la comprobación de prefijo con separador de `servir_estatico`.
- [ ] **Paso 4:** `Pkg.test()` → PASA.
- [ ] **Paso 5: `security-reviewer`** sobre el diff (traversal, codificación de la ruta, cabeceras). Corregir y
  commitear: `Servir la interfaz nueva en /app/ con respaldo de SPA`.

### Tarea 2 · xpand: contrato `contracts/api` y pruebas de contrato

**Archivos:**
- Crear `contracts/api/{catalogo,red,config,sesion}.schema.json`, `contracts/api/examples/*.json` y
  `contracts/api/README.md`.
- Modificar `Project.toml`: `JSONSchema` en `[extras]` y en `[targets] test`, sin tocarlo en `[deps]`.
- Pruebas: `test/runtests.jl`, testset «contrato de la API (contracts/api)».

**Interfaces:**
- Produce los esquemas, draft 2020-12, con `$id` igual a `https://xpand.local/contracts/api/<ruta>.schema.json`.
- **Solo son `required` los campos que lee la interfaz de M0.** Todo objeto admite `additionalProperties: true`.
  El implementador obtiene esos campos de la respuesta real con Garver 6 y los anota en el README:
  - catálogo: motores (id, nombre, formulación o familia) y sus sistemas (id, etiqueta, número de barras, costo
    estimado, avisos si los hay);
  - red: barras, líneas existentes y candidatas, con los campos de la ficha;
  - config: versión y solvers disponibles;
  - sesión: autenticado, nombre, es_admin.

- [ ] **Paso 0: `tdd-guide`.** Revisar la lista de asertos antes de escribir los esquemas.
- [ ] **Paso 1: pruebas que fallan.** Para cada ruta:
  - se llama al manejador real (`api_catalogo`, `api_red` con `motor=jump_misocp`, `sistema=tnep_garver6`,
    `tec=ac`, `api_estado_config`, `api_sesion_ruta`) con una petición local;
  - se valida el cuerpo con `JSONSchema.validate(schema, body) === nothing`;
  - se valida cada `examples/*.json` contra su esquema;
  - además, un esquema mutado (con un `required` inexistente) **debe** fallar, para demostrar que la validación
    muerde.
- [ ] **Paso 2:** `Pkg.test()` → FALLA (faltan los esquemas o el paquete).
- [ ] **Paso 3:** escribir los esquemas y los ejemplos. Los ejemplos se recortan de las respuestas reales de
  Garver 6, sin datos internos.
- [ ] **Paso 4:** `Pkg.test()` → PASA. Commit: `Contrato JSON Schema de las rutas que usa la interfaz nueva (M0)`.

### Tarea 3 · xpand: `scripts/actualizar-ui.sh` y enlace en la GUI legada

**Archivos:**
- Crear `scripts/actualizar-ui.sh`, `web/app/VERSION` y `test/ui/actualizar_ui_test.sh`.
- Modificar la cabecera de `web/index.html` (enlace) y `web/i18n.js` (la traducción EN del texto del enlace).

**Interfaces:**
- `scripts/actualizar-ui.sh <tag> [--archivo dist.tar.gz --sha256 <hex>]`. Sin `--archivo`, descarga
  `dist.tar.gz` y `dist.tar.gz.sha256` del release `<tag>` de `fabianastudillo/xpand-saas` con `gh release
  download`. Salida:
  - 0: ok;
  - 1: el sha256 no coincide;
  - 2: el árbol de `web/app/` tiene cambios sin commitear;
  - 3: el tarball contiene rutas absolutas o con `..`.
- `web/app/VERSION`: dos líneas, `tag=<tag>` y `sha256=<hex>`.

- [ ] **Paso 1: prueba que falla** (`test/ui/actualizar_ui_test.sh`). Con tarballs fabricados en `mktemp -d`:
  - uno correcto → 0, con `web/app/index.html` y `VERSION` escritos;
  - un hash incorrecto → 1;
  - una entrada `../x` → 3, sin escribir nada;
  - un árbol sucio → 2.
- [ ] **Paso 2:** ejecutarla → FALLA.
- [ ] **Paso 3: implementación.**
  - Extraer en un directorio temporal y validar con `tar -tzf` antes de copiar.
  - Sustituir `web/app/` entero, para que no queden restos de builds anteriores.
  - Enlace «Probar la interfaz nueva» → `/app/` en la cabecera de la GUI legada.
- [ ] **Paso 4:** prueba → PASA. **`security-reviewer`** (extracción del tar, verificación del hash, uso de
  `gh`). Commit: `Script para traer la interfaz nueva de xpand-saas y enlace desde la GUI`.

### Tarea 4 · xpand-saas: monorepo, CI y sincronización del contrato

**Archivos:**
- Crear `package.json` (con `packageManager: pnpm@12.14.0`), `pnpm-workspace.yaml`, `.nvmrc` (22),
  `tsconfig.base.json` (strict), `eslint.config.js`, `.github/workflows/ci.yml`,
  `scripts/sync-from-xpand.sh`, `contracts/api/` (copia), `README.md` y `.gitignore`.

**Interfaces:**
- `scripts/sync-from-xpand.sh [--check]`:
  - copia `contracts/api/` desde `XPAND_SRC` (por defecto `../xpand`), con la misma semántica que el script del
    worker;
  - con `--check`, sale con 1 si hay diferencias y con 2 si no encuentra el origen.
- CI, en cada push y PR: `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test`, `e2e` y el
  `--check`. El `--check` hace checkout de `XPAND-PLEXSYS/xpand` con el secreto `XPAND_REPO_TOKEN` (solo lectura,
  `persist-credentials: false`).

- [ ] **Paso 1:** crear la estructura, más una prueba trivial por paquete, para que `pnpm test` exista y pase.
- [ ] **Paso 2:** `pnpm install && pnpm lint && pnpm typecheck && pnpm test` → PASA en local.
  `scripts/sync-from-xpand.sh --check` contra el `contracts/api` de la Tarea 2 → 0.
- [ ] **Paso 3: `security-reviewer`** sobre `ci.yml` (alcance del token, PR desde forks sin secretos, sin
  entradas no confiables en `run:`) y **`typescript-reviewer`** sobre la configuración. Commit:
  `Monorepo de la interfaz nueva: pnpm, TypeScript estricto, CI y contrato sincronizado`.
- [ ] **Paso 4:** pedir al usuario que cree el secreto `XPAND_REPO_TOKEN` en `fabianastudillo/xpand-saas`.
  Confirmar el CI en verde.

### Tarea 5 · xpand-saas: `packages/api`

**Archivos:**
- Crear:
  - `packages/api/src/generated/*.ts`, generado con `json-schema-to-typescript` desde `contracts/api`;
  - `packages/api/src/result.ts`, `client.ts`, `validate.ts` (ajv, solo en desarrollo) y `hooks.ts`;
  - las pruebas `packages/api/src/*.test.ts`.

**Interfaces (las consumen las Tareas 7 y 8):**
- `type ApiError = { kind: 'network' | 'http' | 'auth' | 'schema'; status?: number; route: string; message: string }`
- `type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError }`
- `createClient(opts: { baseUrl?: string; validate?: boolean; fetch?: typeof fetch })` devuelve
  `{ getCatalogo(): Promise<Result<Catalogo>>; getRed(q: { motor: string; sistema: string; tec: string[] }): Promise<Result<Red>>; getConfig(): Promise<Result<Config>>; getSesion(): Promise<Result<Sesion>> }`
- Hooks: `useCatalogo()`, `useRed(q | null)`, `useConfig()` y `useSesion()`, sobre TanStack Query:
  - `staleTime` de 10 min para el catálogo;
  - sin reintento automático para `auth` y `schema`;
  - 1 reintento para `network`.

- [ ] **Paso 0: `tdd-guide`.**
- [ ] **Paso 1: pruebas que fallan,** con `fetch` simulado:
  - 200 válido → `ok: true`;
  - 401 → `kind: 'auth'`;
  - 500 → `kind: 'http'`, `status: 500`;
  - `fetch` lanza → `kind: 'network'`;
  - un cuerpo que no cumple el esquema con `validate: true` → `kind: 'schema'` con la ruta;
  - `getRed({ motor: 'jump_misocp', sistema: 'SNI año/2032 ñ', tec: ['ac','sssc'] })` llama a
    `/api/red?motor=jump_misocp&sistema=SNI%20a%C3%B1o%2F2032%20%C3%B1&tec=ac%2Csssc`.
- [ ] **Paso 2:** `pnpm --filter @xpand/api test` → FALLA.
- [ ] **Paso 3:** implementar. Generación de tipos con `pnpm --filter @xpand/api gen`. Los tipos generados se
  commitean y el CI comprueba que la regeneración no produce diferencias.
- [ ] **Paso 4:** pruebas → PASA. **`typescript-reviewer`**. Commit: `Cliente tipado de la API Julia con errores explícitos`.

### Tarea 6 · xpand-saas: `packages/ui`, tokens, componentes base e i18n

**Archivos:**
- Crear `packages/ui/src/styles/tokens.css`, `packages/ui/src/components/{Button,Badge,Field,Tabs,Tooltip,Kbd,Skeleton,NumberCell}.tsx`,
  `packages/ui/src/i18n/{index.ts,es.json,en.json}` y sus pruebas.

**Interfaces:**
- Tokens, como variables CSS:
  - `--surface`, `--surface-raised`, `--ink`, `--ink-muted`, `--line`, `--accent` (azul ingeniería);
  - `--ok`, `--warn` y `--error`, cada uno con su `-bg` y su `-ink`;
  - `--font-sans` (IBM Plex Sans), `--font-mono` (IBM Plex Mono);
  - `--density` (`normal` | `compact`).
- `<Badge tone="certified" | "uncertified" | "ac-feasible" | "warn" | "error" | "neutral">`. Con
  `"uncertified"` siempre muestra el texto `t('status.uncertified')` (ES «NO CERTIFICADO»), sin icono solo.
- `<NumberCell value={number} unit="MW" digits={1} />`: Plex Mono, alineado a la derecha, con el separador
  decimal del idioma activo.
- `t(key, vars?)`, `useLocale()` y `setLocale('es' | 'en')`. Una clave que falta → en desarrollo lanza; en
  producción muestra la clave.

- [ ] **Paso 1: pruebas que fallan.**
  - `NumberCell` con `1457.8` da «1457,8 MW» en ES y «1457.8 MW» en EN.
  - `Badge uncertified` muestra «NO CERTIFICADO» en ES.
  - `es.json` y `en.json` tienen exactamente las mismas claves.
  - El contraste texto/fondo de cada par de tokens semánticos es ≥ 4.5:1, calculado en la prueba desde
    `tokens.css`.
- [ ] **Paso 2:** → FALLA. **Paso 3:** implementar sobre las primitivas de shadcn. **No se acepta el aspecto por
  defecto de shadcn**: los radios, bordes y tipografía salen de los tokens.
- [ ] **Paso 4:** → PASA. **`a11y-architect`**, **`react-reviewer`** y **`typescript-reviewer`**. Commit:
  `Sistema de diseño técnico claro: tokens, componentes base e i18n por claves`.

### Tarea 7 · xpand-saas: armazón IDE

**Archivos:**
- Crear `packages/ui/src/shell/{AppShell,TopBar,CaseTree,DocumentTabs,Inspector,BottomPanel,ProblemsList,CommandPalette,StatusBar}.tsx`,
  `packages/ui/src/shell/problems.ts` y sus pruebas.

**Interfaces:**
- `type Problem = { id: string; severity: 'error' | 'warn' | 'info'; title: string; cause?: string; action?: { label: string; run: () => void }; target?: { kind: 'bus' | 'line' | 'candidate' | 'route'; id: string } }`
- `useProblems()` → `{ list, add(p), remove(id), clear(source) }`.
- `<CaseTree groups={Array<{ id; label; count; items: Array<{ id; label; detail?: string }> }>} onSelect={(group, id) => void} />`:
  virtualizado por encima de 200 elementos.
- `<CommandPalette commands={Array<{ id; label; group; shortcut?; run }>} />`: se abre con Ctrl+K o ⌘K y filtra
  sin distinguir tildes.
- `<AppShell>`:
  - zonas `top`, `left`, `center`, `right`, `bottom` y `status`;
  - izquierda, derecha y abajo se pliegan, y su estado se guarda en `localStorage`;
  - atajos: Ctrl+B (izquierda), Ctrl+J (abajo), Ctrl+I (inspector).

- [ ] **Paso 1: pruebas que fallan** (Testing Library):
  - Ctrl+K abre la paleta y «garver» encuentra «Abrir Garver 6»;
  - «reduccion» encuentra «Reducción»;
  - el `CaseTree` con 938 elementos monta menos de 100 nodos DOM;
  - se puede recorrer con flechas y abrir con Enter;
  - un `Problem` con `action` muestra su botón y lo ejecuta;
  - plegar el panel inferior conserva el estado tras volver a montar.
- [ ] **Paso 2:** → FALLA. **Paso 3:** implementar.
- [ ] **Paso 4:** → PASA. **`a11y-architect`** (roles `tree`, `tablist` y `dialog`, orden del foco, foco visible),
  **`react-reviewer`** y **`typescript-reviewer`**. Commit: `Armazón IDE: árbol, documentos, inspector, problemas y paleta de comandos`.

### Tarea 8 · xpand-saas: `apps/local`, pantalla «Explorar casos» y e2e

**Archivos:**
- Crear:
  - `apps/local/{index.html,vite.config.ts}` (con `base: '/app/'`);
  - `apps/local/src/{main.tsx,routes.tsx}`;
  - `apps/local/src/features/explorar/{CatalogDocument,CaseDocument,CaseInspector}.tsx`;
  - `apps/local/e2e/explorar.spec.ts` y `apps/local/e2e/mock-api.ts`.

**Interfaces:**
- Rutas:
  - `/app/` → documento «Catálogo»;
  - `/app/casos/:motor/:sistema` → documento del caso, con su árbol en la izquierda, la ficha en el inspector y
    los avisos en «Problemas».
  - El estado (documento abierto, filtros) va en la URL.
- `mock-api.ts` intercepta `/api/*` con `page.route`, sirviendo `contracts/api/examples/*.json`. Admite modos
  `ok`, `slow` (5 s), `401`, `500` y `down`.

- [ ] **Paso 1: e2e que fallan** (Playwright, con **`e2e-runner`**):
  - **Teclado:** abrir `/app/` → filtrar «garver» → Enter → árbol con «Barras (6)» → flecha y Enter sobre «Barra
    2» → el inspector muestra «340,0 MW».
  - **`slow`:** se ve el esqueleto y la paleta sigue abriéndose.
  - **`401`:** «Problemas» muestra el aviso de sesión con el enlace a `/`.
  - **`down`:** error de red con «Reintentar»; tras cambiar a `ok` y pulsarlo, el catálogo carga.
  - **Recarga:** recargar `/app/casos/jump_misocp/tnep_garver6` mantiene el caso abierto.
  - **Capturas** de regresión a 1024 y 1440 px.
  - **axe** sin violaciones AA en el catálogo y en el caso.
- [ ] **Paso 2:** → FALLA. **Paso 3:** implementar.
- [ ] **Paso 4:** `pnpm e2e` → PASA. `pnpm build` y medir: ≤ 300 kB de JS gzip en la ruta inicial (anotar la
  cifra en el PR). **`react-reviewer`** y **`typescript-reviewer`**. Commit: `Pantalla Explorar casos con e2e, accesibilidad y capturas`.

### Tarea 9 · Release v0.1.0 y build en xpand

**Archivos:**
- `xpand-saas/.github/workflows/release.yml`: en cada tag `v*`, `pnpm build`, `dist.tar.gz`, `sha256sum` y
  `gh release create`.
- `xpand-saas/CHANGELOG.md`.
- En xpand, `web/app/**` y `web/app/VERSION`, generados por `scripts/actualizar-ui.sh`.

- [ ] **Paso 1:** `release.yml` y **`security-reviewer`** (permisos mínimos `contents: write` solo en ese job).
- [ ] **Paso 2: pedir confirmación al usuario** antes de crear el tag `v0.1.0` y el release.
- [ ] **Paso 3:** en `xpand`, rama `fabian/gui-m0`: `scripts/actualizar-ui.sh v0.1.0` → 0.
- [ ] **Paso 4: verificación manual con Playwright** contra el servidor real (`bash iniciar_gui.sh 8850`):
  - abrir `/app/`, abrir Garver 6 y seleccionar una barra;
  - capturar las vistas Catálogo y Caso;
  - comprobar en la consola del navegador que no hay errores de tipo MIME ni 404.
  - Las capturas van en el PR, no en el repo.
- [ ] **Paso 5:** commit `Interfaz nueva v0.1.0 en /app/ (M0)`. **`code-reviewer`** sobre la rama completa de
  `xpand` y sobre `main` de `xpand-saas`.
- [ ] **Paso 6: pedir confirmación** antes de abrir el PR a `XPAND-PLEXSYS/xpand:main`. El PR enlaza el release
  y declara «no mueve cifras de referencia».

### Tarea 10 · Documentación

**Archivos:**
- `xpand/CLAUDE.md` y `xpand/README.md`: sección «Interfaz nueva (/app/)», con cómo actualizarla y que la GUI
  clásica sigue en `/`.
- `xpand-saas/README.md`: desarrollo local (`pnpm dev` con proxy de `/api` a `127.0.0.1:8850`), sincronización
  del contrato y release.
- Spec: marcar M0 como hecha.

- [ ] **Paso 1:** escribir. **Paso 2:** commit `Documentación de la interfaz nueva (M0)`.
