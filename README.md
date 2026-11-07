# xpand-saas

Interfaz nueva de XPAND (M0): un monorepo pnpm con la interfaz web, el servidor que la sirve y los paquetes que
comparten. El contrato de la API vive aquí (`contracts/api`); el repositorio `xpand` ya no es una dependencia.

## Estructura

| Ruta | Qué es |
|---|---|
| `apps/web` | Interfaz web (`@xpand/web`), una SPA que el servidor sirve en `/`. |
| `packages/ui` | Componentes compartidos (`@xpand/ui`). |
| `packages/api` | Cliente tipado de la API (`@xpand/api`). |
| `contracts/api` | Contrato JSON Schema de la API. Es la fuente: se edita aquí y `packages/api` genera sus tipos. |
| `scripts/package-dist.sh` | Empaqueta la build de `apps/web` para el release. |

## Desarrollo local

Requisitos: Node 22 (ver `.nvmrc`) y pnpm. El proyecto fija `pnpm@12.14.0` en `packageManager`; con Corepack
(`corepack enable`) se usa esa versión automáticamente.

```bash
pnpm install --frozen-lockfile   # instalar dependencias
pnpm dev                         # Vite en http://127.0.0.1:5173/ con recarga en caliente
```

`pnpm dev` pide los datos a un servidor que corra en la misma máquina en el puerto `XPAND_SERVER_PORT` (por defecto
`8870`). El `vite.config.ts` reenvía **solo `/api`** a `http://127.0.0.1:${XPAND_SERVER_PORT}`; los recursos de la
aplicación los sirve Vite. Si el servidor no está, la interfaz muestra el error en «Problemas» con un botón para
reintentar.

Otros comandos de la raíz:

```bash
pnpm lint                        # ESLint (configuración plana)
pnpm typecheck                   # TypeScript estricto en cada paquete
pnpm test                        # pruebas unitarias, de scripts y comprobación del contrato generado
pnpm build                       # build de los paquetes que lo definan (apps/web/dist)
pnpm --filter @xpand/api gen     # regenerar los tipos de contracts/api (pnpm test comprueba que no difieren)
```

> **Por qué TypeScript está fijado a `~5.9.3`:** typescript-eslint 8.x no da soporte a TypeScript 7. Se sube a 7 cuando la versión de typescript-eslint en uso lo declare como compatible en su `peerDependencies` (y el lint y typecheck pasen).

## Pruebas

| Comando | Qué prueba | Dónde corre |
|---|---|---|
| `pnpm test` | Vitest (unitarias de los paquetes y de la aplicación), pruebas de `scripts/` y `gen:check` | Local y CI |
| `pnpm e2e` | Playwright contra la build de `apps/web` (`vite build` + `vite preview` en `127.0.0.1:4173`), con la API simulada de `apps/web/e2e/mock-api.ts` y `contracts/api/examples`. No hace falta el servidor. | Local y CI |

Antes del primer `pnpm e2e` instala Chromium una vez: `pnpm --filter @xpand/web exec playwright install chromium`.

**Pruebas de capturas (`@visual`).** Sus líneas base viven en `apps/web/e2e/explorar.spec.ts-snapshots/` y dependen
de la máquina y de la versión de Chromium. Por eso CI las excluye (`--grep-invert @visual` cuando existe la variable
`CI`) hasta que se generen en una imagen fijada. Localmente sí corren:

- Para comprobar: `pnpm --filter @xpand/web exec playwright test --grep @visual`.
- Para regenerar las líneas base en la imagen oficial, con la misma versión de `@playwright/test` (1.65.0):

  ```bash
  docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.65.0-noble bash -c "npm i -g pnpm@12.14.0 && pnpm install --frozen-lockfile && pnpm --filter @xpand/web exec playwright test --grep @visual --update-snapshots"
  ```

- Localmente, `pnpm --filter @xpand/web exec playwright test --grep @visual --update-snapshots` sirve para ver
  cambios, pero no sustituye a la imagen fijada.

Revisa las imágenes antes de comprometer las líneas base.

## Contrato de la API

`contracts/api` es la fuente del contrato. Para cambiar una ruta, cambia primero la prueba o el ejemplo que la
describe, luego el esquema, y regenera los tipos con `pnpm --filter @xpand/api gen`. `pnpm test` comprueba que
`packages/api/src/generated` coincide con los esquemas. Los ejemplos de `contracts/api/examples` no contienen datos
de terceros.

## Release

Un release publica la build de `apps/web` como `dist.tar.gz` y su `dist.tar.gz.sha256` en GitHub.

1. En `main`, añade la sección `## vX.Y.Z` a `CHANGELOG.md` con las notas. Sin esa sección con contenido, el
   workflow falla antes de publicar.
2. Crea y sube el tag sobre ese commit: `git tag vX.Y.Z && git push origin vX.Y.Z`. La versión del tag debe ser la de
   `apps/web/package.json`; el workflow lo comprueba.
3. El workflow `.github/workflows/release.yml` se dispara con el tag `v*`:
   - el job `build` instala con el lockfile, construye, empaqueta con `scripts/package-dist.sh` (rechaza mapas,
     enlaces y ficheros especiales) y sube el artefacto; no tiene token de escritura;
   - el job `release` (único con `contents: write`) crea el release con las notas de `CHANGELOG.md`.

Probar el empaquetado sin publicar: `pnpm build && scripts/package-dist.sh apps/web/dist /ruta/de/salida`.

## CI

El workflow `.github/workflows/ci.yml` corre en cada push y pull request: instalación con lockfile congelado,
lint, typecheck, test y e2e. No necesita secretos. El release tampoco: usa el token del propio workflow, con permiso
de escritura solo en el job `release`.
