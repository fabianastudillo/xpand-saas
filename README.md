# xpand-saas

Interfaz nueva de XPAND (M0): un monorepo pnpm con la aplicación local y los paquetes que comparte. El motor de
cálculo sigue en el repo [XPAND-PLEXSYS/xpand](https://github.com/XPAND-PLEXSYS/xpand); aquí solo se consume su
contrato de la API.

## Estructura

| Ruta | Qué es |
|---|---|
| `apps/local` | Aplicación local (`@xpand/local`). |
| `packages/ui` | Componentes compartidos (`@xpand/ui`). |
| `packages/api` | Cliente tipado de la API (`@xpand/api`). |
| `contracts/api` | Copia del contrato JSON Schema de la API, sincronizada desde `xpand`. No se edita a mano. |
| `scripts/sync-from-xpand.sh` | Copia o comprueba `contracts/api` frente al repo `xpand`. |

## Desarrollo local

Requisitos: Node 22 (ver `.nvmrc`) y pnpm. El proyecto fija `pnpm@12.14.0` en `packageManager`; con Corepack
(`corepack enable`) se usa esa versión automáticamente.

```bash
pnpm install --frozen-lockfile   # instalar dependencias
pnpm lint                        # ESLint (configuración plana)
pnpm typecheck                   # TypeScript estricto en cada paquete
pnpm test                        # Vitest
pnpm --filter @xpand/api gen    # regenerar los tipos de contracts/api (pnpm test comprueba que no difieren)
pnpm e2e                         # placeholder hasta la Tarea 8
pnpm build                       # build de los paquetes que lo definan
pnpm test:scripts                # pruebas de scripts/sync-from-xpand.sh (también en pnpm test)
```

> **Por qué TypeScript está fijado a `~5.9.3`:** typescript-eslint 8.x no da soporte a TypeScript 7. Se sube a 7 cuando la versión de typescript-eslint en uso lo declare como compatible en su `peerDependencies` (y el lint y typecheck pasen).

## Sincronizar el contrato

`contracts/api` es una copia del contrato que vive en `xpand`:

```bash
XPAND_SRC=/ruta/a/xpand scripts/sync-from-xpand.sh          # copiar (sobrescribe)
XPAND_SRC=/ruta/a/xpand scripts/sync-from-xpand.sh --check  # solo comprobar
```

`XPAND_SRC` apunta a la raíz del repo `xpand` (por defecto `../xpand`). Códigos de salida: `0` sincronizado,
`1` hay diferencias (con `--check`), `2` no se encuentra el origen.

## CI

El workflow `.github/workflows/ci.yml` corre en cada push y pull request: instalación con lockfile congelado,
lint, typecheck, test y e2e. El job `contract` clona `XPAND-PLEXSYS/xpand` y ejecuta `--check`.

Configuración necesaria en GitHub (Settings del repositorio):

- **Secreto `XPAND_REPO_TOKEN`**: token de acceso de solo lectura (PAT de grano fino) sobre
  `XPAND-PLEXSYS/xpand`. Sin él, el job `contract` falla con un mensaje claro. Los pull requests desde forks no
  reciben secretos y verán ese mismo fallo.
- **Variable `XPAND_CONTRACT_REF`** (opcional): rama o commit de `xpand` contra el que se comprueba el contrato.
  Por defecto `main`. Durante M0 vale `fabian/gui-m0`.
