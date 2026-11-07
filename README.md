# xpand-saas

Interfaz nueva de XPAND (M0): un monorepo pnpm con la interfaz web, el servidor que la sirve y los paquetes que
comparten. El contrato de la API vive aquí (`contracts/api`); el repositorio `xpand` ya no es una dependencia.

## Estructura

| Ruta | Qué es |
|---|---|
| `apps/web` | App Next (`@xpand/web`): la plantilla open-micro-saas (público, cuentas, administración), las rutas `/api` de los casos y la zona IDE «Explorar casos» (`/casos`). Ver «App web (`apps/web`)». |
| `packages/ui` | Componentes compartidos (`@xpand/ui`). |
| `packages/api` | Cliente tipado de la API (`@xpand/api`). |
| `contracts/api` | Contrato JSON Schema de la API. Es la fuente: se edita aquí y `packages/api` genera sus tipos. |
| `scripts/package-dist.sh` | Empaqueta una build estática para el release (pendiente de adaptar al despliegue de la app Next: Task 9). |

## Desarrollo local

Requisitos: Node 22 (ver `.nvmrc`) y pnpm. El proyecto fija `pnpm@12.14.0` en `packageManager`; con Corepack
(`corepack enable`) se usa esa versión automáticamente.

```bash
pnpm install --frozen-lockfile   # instalar dependencias
pnpm dev                         # app Next (apps/web) en http://localhost:8870/ (escucha en 127.0.0.1)
```

«Explorar casos» está en `http://localhost:8870/casos` y no necesita Postgres: lee los casos de la carpeta del
almacén (`XPAND_ALMACEN`, por defecto `~/.xpand-saas/almacen`; la llenan los importadores). Si la carpeta no existe o está
vacía, el catálogo sale vacío y «Problemas» explica cómo importarlos. Las cuentas (entrada, perfil, administración) sí
necesitan Postgres (ver «App web»).

Para llenar el almacén desde un checkout de xpand (necesita Julia y las dependencias de ese checkout instaladas):

```bash
pnpm importar-casos --xpand ../xpand [--almacen <dir>] [--incluir-internos] [--volcado <catalogo.json>]
```

El checkout solo se lee: el catálogo se vuelca con `scripts/julia/volcar-catalogo.jl` y todas las salidas de Julia van a
una carpeta temporal; si `git status --ignored` del checkout cambia, se aborta. Solo entran como públicos los sistemas de
`config/casos-publicos.json` (id, carpeta de datos y fuente pública con DOI o URL de cada uno); con `--incluir-internos` entra el resto
como `interno`, que la plataforma no sirve. El almacén se sustituye entero en cada importación (solo una carpeta vacía o
escrita por el importador).

Otros comandos de la raíz:

```bash
pnpm lint                        # ESLint (configuración plana)
pnpm typecheck                   # TypeScript estricto en cada paquete
pnpm test                        # pruebas unitarias, de scripts y comprobación del contrato generado
pnpm build                       # build de los paquetes que lo definan
pnpm --filter @xpand/api gen     # regenerar los tipos de contracts/api (pnpm test comprueba que no difieren)
```

> **Por qué TypeScript está fijado a `~5.9.3`:** typescript-eslint 8.x no da soporte a TypeScript 7. Se sube a 7 cuando la versión de typescript-eslint en uso lo declare como compatible en su `peerDependencies` (y el lint y typecheck pasen).

## App web (`apps/web`)

`apps/web` es la plantilla [open-micro-saas](https://github.com/product-makers-hub/open-micro-saas) (MIT,
`apps/web/LICENSE.md`), copiada de `saas-plantilla` en el commit `43e65a1` y subida a Next 15, React 19 y
Tailwind 4. Da las zonas pública, de usuario y de administración, cuentas con next-auth (enlace mágico por
correo y Google opcional), Prisma con Postgres y, apagados mientras no tengan claves, pagos (Stripe), analítica y
soporte. Sin claves ninguna página falla ni habla con terceros (lo prueba `tests/**/sin-terceros*.spec.ts`).

**Zona IDE «Explorar casos» (`/casos`, `/casos/<motor>/<sistema>`).** Es un grupo de rutas con su **propio layout raíz**
(`src/app/(ide)`): su documento, su hoja de estilos (`src/ide/ide.css`: Tailwind + tokens de `@xpand/ui`) y ninguna
dependencia de sesión ni de base de datos; el resto del sitio vive en `src/app/(site)`. Así los estilos de una zona no
llegan a la otra, y ir del sitio a la zona es una navegación completa. La zona se pinta solo en el navegador
(`dynamic` sin SSR, como era la SPA): el servidor entrega un armazón estático. Su código está en `src/ide` (pantallas
en `features/explorar`, marco y rutas en `app`, textos ES/EN en `i18n`); usa `@xpand/ui`, `@xpand/api` (con
validación de esquema también en producción) y las rutas `/api` de la app.

```bash
cp apps/web/.env.example apps/web/.env   # rellena NEXTAUTH_SECRET y la contraseña de Postgres
pnpm db:start                            # Postgres de desarrollo (docker compose) en 127.0.0.1:6500
pnpm --filter @xpand/web db:migrate:dev  # migraciones de Prisma
pnpm dev                                 # Next en http://localhost:8870/ (escucha en 127.0.0.1)
```

`pnpm dev` y `pnpm start` pasan por `apps/web/scripts/arranque.mjs`: Next escucha solo en `127.0.0.1` y en el
puerto `XPAND_WEB_PORT` (8870). Un `HOST` que no sea local sin `XPAND_PERMITIR_RED=1` aborta con código 64, y
`pnpm start` exige `AUTH_URL`. El navegador ve la app como `localhost:8870`: Next normaliza todo host de bucle a
`localhost`, y Auth.js monta sobre él los enlaces de entrada.

Pruebas de la app: `pnpm --filter @xpand/web test` (Vitest) y, con Postgres de prueba,

```bash
pnpm --filter @xpand/web test:db:start    # Postgres de prueba en 127.0.0.1:5433 (apps/web/.env.test)
pnpm --filter @xpand/web test:db:prepare  # migraciones
pnpm --filter @xpand/web exec playwright install chromium firefox   # una vez
pnpm e2e                                  # Playwright de apps/web (levanta `pnpm dev` y un SMTP de prueba)
pnpm --filter @xpand/web test:db:stop     # parar el contenedor
```

Los valores de `apps/web/.env.test` (secreto de sesión, contraseña de Postgres) son locales y regenerables.

## Pruebas

| Comando | Qué prueba | Dónde corre |
|---|---|---|
| `pnpm test` | Vitest (unitarias de los paquetes y de las aplicaciones), pruebas de `scripts/` y `gen:check` | Local y CI |
| `pnpm e2e` | Playwright de `apps/web`: la plantilla (entrada, perfil, administración, accesibilidad, sin terceros) y la zona IDE (`tests/ide`, proyecto «chromium - ide»), esta última contra la app real y el almacén de prueba `packages/casos/test/almacen`; `tests/ide/mock-api.ts` solo tuerce las respuestas de `/api` para los fallos (401, 500, 503, esquema, red caída) y el catálogo grande. Necesita el Postgres de prueba (ver «App web»). | Local y CI (job `e2e-web`) |

Antes del primer `pnpm e2e` instala los navegadores una vez: `pnpm --filter @xpand/web exec playwright install chromium firefox`.
Solo la zona IDE: `pnpm --filter @xpand/web exec playwright test --project="chromium - ide"`. La prueba
`tests/ide/sin-postgres.spec.ts` levanta un segundo servidor (puerto `XPAND_WEB_PORT_SIN_POSTGRES`, 8871) con la base
de datos apuntando a un puerto muerto y comprueba que la zona sigue funcionando.

**Pruebas de capturas (`@visual`).** Sus líneas base viven en `apps/web/tests/ide/explorar.spec.ts-snapshots/` y dependen
de la máquina y de la versión de Chromium. Por eso CI las excluye (`--grep-invert @visual` cuando existe la variable
`CI`) hasta que se generen en una imagen fijada. Localmente sí corren:

- Para comprobar: `pnpm --filter @xpand/web exec playwright test --project="chromium - ide" --grep @visual`.
- Para regenerar las líneas base en la imagen oficial, con la misma versión de `@playwright/test` (1.65.0):

  ```bash
  docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.65.0-noble bash -c "npm i -g pnpm@12.14.0 && pnpm install --frozen-lockfile && pnpm --filter @xpand/web exec playwright test --project=\"chromium - ide\" --grep @visual --update-snapshots"
  ```

- Localmente, `pnpm --filter @xpand/web exec playwright test --project="chromium - ide" --grep @visual --update-snapshots` sirve para ver
  cambios, pero no sustituye a la imagen fijada.

Revisa las imágenes antes de comprometer las líneas base.

## Contrato de la API

`contracts/api` es la fuente del contrato. Para cambiar una ruta, cambia primero la prueba o el ejemplo que la
describe, luego el esquema, y regenera los tipos con `pnpm --filter @xpand/api gen`. `pnpm test` comprueba que
`packages/api/src/generated` coincide con los esquemas. Los ejemplos de `contracts/api/examples` no contienen datos
de terceros.

## Release

Un release publica una build estática como `dist.tar.gz` y su `dist.tar.gz.sha256` en GitHub. **Pendiente (Task 9):** la
SPA que empaquetaba ya no existe (la zona IDE es parte de la app Next); el workflow y `scripts/package-dist.sh` se
adaptan al despliegue de la app Next.

1. En `main`, añade la sección `## vX.Y.Z` a `CHANGELOG.md` con las notas. Sin esa sección con contenido, el
   workflow falla antes de publicar.
2. Crea y sube el tag sobre ese commit: `git tag vX.Y.Z && git push origin vX.Y.Z`. La versión del tag debe ser la de
   `apps/web/package.json`; el workflow lo comprueba (pendiente de actualizar en la Task 9).
3. El workflow `.github/workflows/release.yml` se dispara con el tag `v*`:
   - el job `build` instala con el lockfile, construye, empaqueta con `scripts/package-dist.sh` (rechaza mapas,
     enlaces y ficheros especiales) y sube el artefacto; no tiene token de escritura;
   - el job `release` (único con `contents: write`) crea el release con las notas de `CHANGELOG.md`.

Probar el empaquetado sin publicar: `scripts/package-dist.sh <directorio de build> /ruta/de/salida`.

## CI

El workflow `.github/workflows/ci.yml` corre en cada push y pull request: instalación con lockfile congelado,
lint, typecheck, test y, en el job `e2e-web`, los e2e de `apps/web`. No necesita secretos. El release tampoco: usa el token del propio workflow, con permiso
de escritura solo en el job `release`.
