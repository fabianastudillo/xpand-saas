# xpand-saas

Interfaz nueva de XPAND (M0): un monorepo pnpm con la aplicación local y los paquetes que comparte. El motor de
cálculo sigue en el repo [XPAND-PLEXSYS/xpand](https://github.com/XPAND-PLEXSYS/xpand); aquí solo se consume su
contrato de la API.

## Estructura

| Ruta | Qué es |
|---|---|
| `apps/local` | Aplicación local (`@xpand/local`), que se sirve bajo `/app/` desde el servidor de XPAND. |
| `packages/ui` | Componentes compartidos (`@xpand/ui`). |
| `packages/api` | Cliente tipado de la API (`@xpand/api`). |
| `contracts/api` | Copia del contrato JSON Schema de la API, sincronizada desde `xpand`. No se edita a mano. |
| `scripts/sync-from-xpand.sh` | Copia o comprueba `contracts/api` frente al repo `xpand`. |
| `scripts/package-dist.sh` | Empaqueta la build de `apps/local` para el release. |

## Desarrollo local

Requisitos: Node 22 (ver `.nvmrc`) y pnpm. El proyecto fija `pnpm@12.14.0` en `packageManager`; con Corepack
(`corepack enable`) se usa esa versión automáticamente.

```bash
pnpm install --frozen-lockfile   # instalar dependencias
pnpm dev                         # Vite en http://127.0.0.1:5173/app/ con recarga en caliente
```

`pnpm dev` pide los datos a un servidor XPAND que corra en la misma máquina en el puerto 8850 (en `xpand`:
`INICIAR_GUI.bat` en Windows o `./iniciar_gui.sh 8850`). El `vite.config.ts` reenvía **solo `/api`** a
`http://127.0.0.1:8850`; los recursos de la aplicación los sirve Vite. Como la conexión llega desde la propia máquina,
el servidor deja entrar sin sesión. Si el servidor no está, la interfaz muestra el error en «Problemas» con un botón
para reintentar.

Otros comandos de la raíz:

```bash
pnpm lint                        # ESLint (configuración plana)
pnpm typecheck                   # TypeScript estricto en cada paquete
pnpm test                        # pruebas unitarias, de scripts y comprobación del contrato generado
pnpm build                       # build de los paquetes que lo definan (apps/local/dist)
pnpm --filter @xpand/api gen     # regenerar los tipos de contracts/api (pnpm test comprueba que no difieren)
```

> **Por qué TypeScript está fijado a `~5.9.3`:** typescript-eslint 8.x no da soporte a TypeScript 7. Se sube a 7 cuando la versión de typescript-eslint en uso lo declare como compatible en su `peerDependencies` (y el lint y typecheck pasen).

## Pruebas

| Comando | Qué prueba | Dónde corre |
|---|---|---|
| `pnpm test` | Vitest (unitarias de los paquetes y de la aplicación), pruebas de `scripts/` y `gen:check` | Local y CI |
| `pnpm e2e` | Playwright contra la build de `apps/local` (`vite build` + `vite preview` en `127.0.0.1:4173`), con la API simulada de `apps/local/e2e/mock-api.ts` y `contracts/api/examples`. No hace falta el servidor Julia. | Local y CI |

Antes del primer `pnpm e2e` instala Chromium una vez: `pnpm --filter @xpand/local exec playwright install chromium`.

**Pruebas de capturas (`@visual`).** Sus líneas base viven en `apps/local/e2e/explorar.spec.ts-snapshots/` y dependen
de la máquina y de la versión de Chromium. Por eso CI las excluye (`--grep-invert @visual` cuando existe la variable
`CI`) hasta que se generen en una imagen fijada. Localmente sí corren:

- Para comprobar: `pnpm --filter @xpand/local exec playwright test --grep @visual`.
- Para regenerar las líneas base en la imagen oficial, con la misma versión de `@playwright/test` (1.65.0):

  ```bash
  docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.65.0-noble bash -c "npm i -g pnpm@12.14.0 && pnpm install --frozen-lockfile && pnpm --filter @xpand/local exec playwright test --grep @visual --update-snapshots"
  ```

- Localmente, `pnpm --filter @xpand/local exec playwright test --grep @visual --update-snapshots` sirve para ver
  cambios, pero no sustituye a la imagen fijada.

Revisa las imágenes antes de comprometer las líneas base.

## Sincronizar el contrato

`contracts/api` es una copia del contrato que vive en `xpand`:

```bash
XPAND_SRC=/ruta/a/xpand scripts/sync-from-xpand.sh          # copiar (sobrescribe)
XPAND_SRC=/ruta/a/xpand scripts/sync-from-xpand.sh --check  # solo comprobar
```

`XPAND_SRC` apunta a la raíz del repo `xpand` (por defecto `../xpand`). Códigos de salida: `0` sincronizado,
`1` hay diferencias (con `--check`), `2` no se encuentra el origen, `64` uso incorrecto.

Cuando `xpand` cambie una ruta, sincroniza, corre `pnpm --filter @xpand/api gen` y `pnpm test`, y commitea
`contracts/api` y `packages/api/src/generated` juntos.

## Release

Un release publica la build de `apps/local` como `dist.tar.gz` y su `dist.tar.gz.sha256` en GitHub. `xpand` la
instala después con `scripts/actualizar-ui.sh`.

1. En `main`, añade la sección `## vX.Y.Z` a `CHANGELOG.md` con las notas. Sin esa sección con contenido, el
   workflow falla antes de publicar.
2. Crea y sube el tag sobre ese commit: `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. El workflow `.github/workflows/release.yml` se dispara con el tag `v*`:
   - el job `build` instala con el lockfile, construye, empaqueta con `scripts/package-dist.sh` (rechaza mapas,
     enlaces y ficheros especiales) y sube el artefacto; no tiene token de escritura;
   - el job `release` (único con `contents: write`) crea el release con las notas de `CHANGELOG.md`.
4. En `xpand`, en su rama: `scripts/actualizar-ui.sh vX.Y.Z`, revisar `web/app/VERSION` y el diff, y commitear
   `web/app/` por PR.

Probar el empaquetado sin publicar: `pnpm build && scripts/package-dist.sh apps/local/dist /ruta/de/salida`.

## CI y configuración de GitHub

El workflow `.github/workflows/ci.yml` corre en cada push y pull request: instalación con lockfile congelado,
lint, typecheck, test y e2e. El job `contract` clona `XPAND-PLEXSYS/xpand` y ejecuta `--check`.

Configuración necesaria en GitHub (Settings del repositorio):

- **Secreto `XPAND_REPO_TOKEN`**: token de acceso de solo lectura (PAT de grano fino) sobre
  `XPAND-PLEXSYS/xpand`. Sin él, el job `contract` falla con un mensaje claro. Los pull requests desde forks no
  reciben secretos y verán ese mismo fallo.
- **Variable `XPAND_CONTRACT_REF`** (opcional): rama o commit de `xpand` contra el que se comprueba el contrato.
  Por defecto `main`. Durante M0 vale `fabian/gui-m0`.

El release no necesita secretos: usa el token del propio workflow, con permiso de escritura solo en el job `release`.
