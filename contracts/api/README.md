# Contrato de la API (M0)

Esquemas JSON Schema de las cuatro rutas de solo lectura que usa la interfaz en `/`, servidas bajo `/api` por
`apps/web` (route handlers de Next):

| Ruta | Esquema |
|---|---|
| `GET /api/catalogo` | `catalogo.schema.json` |
| `GET /api/red?motor=&sistema=&tec=` | `red.schema.json` |
| `GET /api/config` | `config.schema.json` |
| `GET /api/sesion` | `sesion.schema.json` |

Este directorio es la fuente del contrato: se edita aquí. `packages/api` genera sus tipos desde estos esquemas
(`pnpm --filter @xpand/api gen`) y `pnpm test` comprueba que no difieren.

- **Draft:** JSON Schema draft-07 (`"$schema": "http://json-schema.org/draft-07/schema#"`).
- **`$id`:** `https://xpand.local/contracts/api/<ruta>.schema.json`. Es un identificador, no una URL que se consulte:
  no hay red en tiempo de ejecución.
- **`title`:** `Catalogo`, `Red`, `Config`, `Sesion`. Los tipos de TypeScript se generan con esos nombres.
- **Solo lo que lee la interfaz es `required`.** Todo objeto admite propiedades extra (`additionalProperties: true`):
  el servidor puede añadir campos sin romper la interfaz. Lo que no se exige no se valida.

## Campos exigidos por ruta

### `catalogo` (`GET /api/catalogo`)

- Raíz: `motores` (array).
- Motor: `id`, `nombre`, `sistemas`, y **`formulacion` o `familia`** (basta una de las dos; `anyOf`).
- Sistema: `id`, `nombre` (es la etiqueta visible), `barras` (entero).
- Opcionales (la interfaz los muestra cuando existen):
  - `nota` del sistema: el aviso del sistema («avisos si los hay»).
  - `dificultad` (p. ej. `"rapido"`).
  - `referencias[].valor`: el valor de referencia certificado. Solo algunos sistemas lo traen.

### `red` (`GET /api/red?motor=jump_misocp&sistema=tnep_garver6&tec=ac`)

- Raíz: `barras`, `ac_existentes`, `ac_candidatos` (arrays).
- Barra: `id`, `etiqueta`, `kv`, `pd`, `qd`, `vmin`, `vmax`. `nombre` es **opcional**: solo existe cuando el caso
  trae nombres del operador. `etiqueta` es obligatoria y puede ser el propio id. La interfaz rotula la barra con
  `nombre ?? etiqueta ?? id`.
- Línea existente: `id`, `de`, `a`, `r`, `x`, `s`.
- Línea candidata: `id`, `de`, `a`, `r`, `x`, `s`, `costo`, `nmax`.

El `id` de la barra y los extremos `de` y `a` de las líneas son identificadores de barra: cadenas (`"1"`, `"2"`) o
**enteros** (`idBarra`, `["string", "integer"]`). `packages/api` (`normalizeRed`) los normaliza a cadena en un único
sitio; la interfaz nunca compara identificadores de tipos distintos.

### `config` (`GET /api/config`)

- Raíz: `version` (cadena), la versión de la plataforma. La interfaz la muestra en el pie junto a la suya.
- `cupo` se valida si aparece, pero no es obligatorio.

Los solvers no están en esta respuesta: viven en `/api/catalogo`, en `motores[].solvers[]`.

### `sesion` (`GET /api/sesion`)

- Raíz: `dentro` (booleano), `local` (booleano), `nombre` (cadena; vacía si no hay sesión).

## Ejemplos

`examples/<ruta>.json` son respuestas de ejemplo del caso público Garver 6. Un ejemplo nuevo se recorta a mano de una
respuesta real y se valida con las pruebas. No hay datos de SNI, CENACE ni SDDP en ningún ejemplo.

## Pruebas

- `packages/api`: `gen:check` (los tipos generados coinciden con los esquemas) y las pruebas del validador, que
  comprueban que cada esquema acepta su ejemplo.
- `apps/web` (Task 5): las rutas validan sus respuestas contra estos esquemas (`src/server/rutas-*.test.ts`).

## Cómo cambiar un contrato

1. Cambiar primero la prueba (o el ejemplo) y ver que falla.
2. Cambiar el esquema y, si la respuesta cambió, el ejemplo.
3. `pnpm --filter @xpand/api gen` y `pnpm test`.

Un campo nuevo que la interfaz lea se añade a `required` solo si el servidor lo garantiza siempre.
