# Contrato de la API para la interfaz nueva (M0)

Esquemas JSON Schema de las cuatro rutas de solo lectura que usa la interfaz nueva en `/app/`:

| Ruta | Esquema | Manejador en `src/servidor.jl` |
|---|---|---|
| `GET /api/catalogo` | `catalogo.schema.json` | `api_catalogo` |
| `GET /api/red?motor=&sistema=&tec=` | `red.schema.json` | `api_red` |
| `GET /api/config` | `config.schema.json` | `api_estado_config` |
| `GET /api/sesion` | `sesion.schema.json` | `api_sesion_ruta` |

- **Draft:** JSON Schema draft-07 (`"$schema": "http://json-schema.org/draft-07/schema#"`). Es el draft que
  soportan bien JSONSchema.jl, ajv y json-schema-to-typescript.
- **`$id`:** `https://xpand.local/contracts/api/<ruta>.schema.json`. Es un identificador, no una URL que se consulte:
  no hay red en tiempo de ejecucion.
- **`title`:** `Catalogo`, `Red`, `Config`, `Sesion`. Los tipos de TypeScript se generan con esos nombres.
- **Solo lo que lee la interfaz es `required`.** Todo objeto admite propiedades extra (`additionalProperties: true`):
  el servidor puede añadir campos sin romper la interfaz. Lo que no se exige no se valida.

## Campos exigidos por ruta

### `catalogo` (`GET /api/catalogo`)

- Raiz: `motores` (array).
- Motor: `id`, `nombre`, `sistemas`, y **`formulacion` o `familia`** (basta una de las dos; `anyOf`).
- Sistema: `id`, `nombre` (es la etiqueta visible), `barras` (entero).
- Opcionales (la interfaz los muestra cuando existen; la pantalla de M0 decide cual usa para el «costo estimado»):
  - `nota` del sistema: el aviso del sistema («avisos si los hay»).
  - `dificultad` (p. ej. `"rapido"`): presente en los 2883 sistemas; candidata natural a «costo estimado» de
    ejecutar el caso.
  - `referencias[].valor`: el valor de referencia certificado. Solo 124 de los 2883 sistemas lo traen.

### `red` (`GET /api/red?motor=jump_misocp&sistema=tnep_garver6&tec=ac`)

- Raiz: `barras`, `ac_existentes`, `ac_candidatos` (arrays).
- Barra (campos de la ficha): `id`, `etiqueta`, `kv`, `pd`, `qd`, `vmin`, `vmax`. `nombre` es **opcional**: solo
  existe cuando el caso trae fichero de nombres del operador (Garver 6 lo trae; `sdp_tnep`, `lshade`, `gep_*` y
  `real` no). `etiqueta` la emiten los cinco constructores de `packages/XpandCore/src/red.jl` y puede ser el propio
  id. La interfaz rotula la barra con `nombre ?? etiqueta ?? id`.
- Linea existente: `id`, `de`, `a`, `r`, `x`, `s`.
- Linea candidata: `id`, `de`, `a`, `r`, `x`, `s`, `costo`, `nmax`.

El `id` de la barra y los extremos `de` y `a` de las lineas son identificadores de barra: cadenas (`"1"`, `"2"`)
en los casos `.dat` y `.m`, y **enteros** en el motor `real` (`Red.red_real`, red del SNI). El esquema admite ambos
(`idBarra`, `["string", "integer"]`) porque el contrato refleja la API real y M0 no cambia la salida del servidor;
la interfaz los normaliza a cadena en un unico sitio (`packages/api` de xpand-saas). Comprobado el 07/11/2026 con
la pasada por motor (abajo, prueba 5).

### `config` (`GET /api/config`)

- Raiz: `version` (cadena).
- `cupo` se valida si aparece, pero no es obligatorio.

**Los solvers no estan en esta respuesta.** La especificacion pedia «versión y solvers disponibles», pero
`/api/config` no devuelve ningun campo de solvers. Los solvers y su estado (`instalado`) viven en
`/api/catalogo`, en `motores[].solvers[]`. La interfaz debe leerlos de ahi.

### `sesion` (`GET /api/sesion`)

- Raiz: `dentro` (booleano), `local` (booleano), `nombre` (cadena; vacia si no hay sesion).

Equivalencias con los nombres de la especificacion:

- «autenticado» = `dentro`.
- «es_admin» **no existe** en la respuesta. La respuesta tiene `local`, que es `true` cuando la peticion llega desde
  esta misma maquina y entra como administrador local. Un administrador que entra con la llave (`X-GTNEP-Admin`)
  no se distingue de un usuario con sesion. Si la interfaz necesita esa distincion, hay que añadir el campo al
  servidor; este contrato no lo inventa.

## Ejemplos

`examples/<ruta>.json` son recortes de respuestas reales de Garver 6 (caso publico):

- `catalogo.json`: dos motores (`jump_misocp`, `fp_dc`), dos sistemas de cada uno, sin `archivos` ni `caso_m`
  (rutas absolutas de la maquina) ni `dispositivos`.
- `red.json`: el sistema `tnep_garver6` completo para barras y lineas existentes, y tres de sus candidatas.
- `config.json`: la respuesta real con las rutas de la maquina del autor sustituidas por `/ejemplo/xpand/...`.
- `sesion.json`: la respuesta real con el nombre de usuario sustituido por «Usuario de ejemplo».

No hay datos de SNI, CENACE, SDDP ni de `data/casos/usuario` en ningun ejemplo. Un ejemplo nuevo se recorta
a mano de una respuesta real de Garver 6 y se valida con las pruebas.

## Pruebas

En `test/runtests.jl`, testset «contrato de la API (contracts/api)»:

1. Cada manejador real se llama con una peticion desde `127.0.0.1` y su cuerpo se valida con
   `JSONSchema.validate(schema, body) === nothing`.
2. Cada `examples/<ruta>.json` existe y cumple su esquema.
3. Cada esquema es draft-07, con `$id`, `title` y todos los objetos con `additionalProperties: true`.
4. Un esquema mutado (con un `required` que no existe en la respuesta) debe fallar: demuestra que la validacion
   muerde.
5. Pasada por motor: el primer sistema de **cada** motor del catalogo se pide a `api_red` con `tec=ac` y toda
   respuesta 200 debe cumplir `red.schema.json`. Las respuestas no-200 no fallan la prueba (en CI pueden faltar
   datos LFS). Asi el `required` queda demostrado sobre todas las familias, no declarado a partir de Garver 6. Los
   datos solo se leen; ninguno se copia a fichero.

JSONSchema.jl es **solo de pruebas**: esta en `[extras]` y `[targets] test` de `Project.toml`, no en `[deps]`.

## Como cambiar un contrato

1. Cambiar primero la prueba (o el ejemplo) y ver que falla.
2. Cambiar el esquema y, si la respuesta real cambio, el ejemplo.
3. `GTNEP_TEST_OPF=0 XPAND_TEST_PROFILE=ci julia --project=. -e 'using Pkg; Pkg.test()'`.

Un campo nuevo que la interfaz lea se añade a `required` solo si el servidor lo garantiza siempre, y «siempre» lo
demuestra la pasada por motor (prueba 5), no un solo caso.
