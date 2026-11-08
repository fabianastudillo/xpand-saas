# Fixtures de `@xpand/core`

Inventario de `packages/core/fixtures/`, copiado de `contracts/fixtures/` de la rama `personal/003-port-red-ts`
(commit `d224586` del repositorio `TEP/xpand`). Solo entran fixtures **públicos o sintéticos** (FR-009, Principio II):
ningún dato del SNI, de CENACE ni de SDDP (`*.psr`), ni extractos ni derivados de ellos.

Los `expected.json` salen solo de la salida del Julia de referencia y no se editan a mano. Las referencias a
`packages/XpandCore/...` y a `specs/...` de los READMEs son de la fuente original y se conservan como procedencia.

## Inventario

| Carpeta | Fuente | Clasificación | Qué ejercita |
|---|---|---|---|
| `ampl/formas` | escrito para la prueba | sintético | `readAmplDat`: todas las formas del `.dat` |
| `plan/completo` | escrito para la prueba | sintético | `readPlan`: plan completo |
| `plan/truncado` | escrito para la prueba | sintético | `readPlan`: plan sin cierre |
| `plan/multiples_bloques` | escrito para la prueba | sintético | `readPlan`: varios bloques |
| `matpower/case118` | MATPOWER, tag 8.1, commit `1a828c7` | público (licencia en `LICENSE-MATPOWER.txt`) | `readMatpowerTables` sobre IEEE 118 |
| `matpower/garver6_hvdc_pm` | `test/fixtures` del repo GTNEP (exportado 2026-09-27) | público (caso Garver de la literatura) | tablas HVDC y candidatos |
| `red/misocp/solo_base` | escrito para la prueba | sintético | `redMisocp`: base sin tecnologías |
| `red/misocp/base_mas_tecnologia` | escrito para la prueba | sintético | `redMisocp`: precedencia base/tecnología |
| `red/misocp/base_dinamica_econ` | escrito para la prueba | sintético | `redMisocp`: `dinamica.dat` y `econ.dat` |
| `red/gfmgfl/sintetico` | escrito para la prueba | sintético | `redGfmgfl` |
| `red/matpower/case118` | la de `matpower/case118` (referencia, sin copia) | público | `redMatpower` sobre IEEE 118 |
| `red/matpower/garver6_hvdc_pm` | la de `matpower/garver6_hvdc_pm` (referencia, sin copia) | público | `redMatpower` sobre Garver |
| `red/matpower/sintetico_extensiones` | escrito para la prueba | sintético | `redMatpower`: extensiones `ne_branch`, `busdc`, HVDC |
| `red/real/sintetico` | escrito para la prueba | sintético | `redReal`: `red.json` mínimo |
| `red/hidro/sintetico` | escrito para la prueba | sintético | `redHidro`: tres etapas, centrales ficticias `HID_*`/`TER_*` |
| `red/sitios/suma_larga` | escrito para la prueba | sintético | `leerSitios`: suma secuencial de 40 puntos (D1) |
| `red/sitios/sintetico` | (ver abajo) | **omitido** | `leerSitios`: `IBRSITE_EXT`, NGX, estrellas |

Los ficheros `manifest.json`, `README.md` y `red/README.md` se copian tal cual, con la misma procedencia.

## Omitido: `red/sitios/sintetico`

Su entrada sigue en `manifest.json` (con su MD5 original), pero la carpeta **no se copia**. En `fixtures.test.ts`,
la constante `OMITIDOS` la excluye del chequeo de registro y `it.skipIf` marca sus dos pruebas como `skip`.

Motivo: el fichero declara ser sintético, pero uno de sus nombres de central procede de la lista de anexos de un
caso interno del proyecto (`ibr_sitios.dat` y `gen_candidatos.dat` del caso de referencia, en `data/casos/usuario/`).
Ninguna línea del fichero coincide literalmente con la del caso interno, pero el nombre es un derivado parcial de
datos internos y FR-009 no admite derivados. El nombre no se escribe en este documento.

Para recuperar la prueba hace falta regenerar ese fixture **en el repositorio de origen** con un nombre neutro y su
`expected.json` con el Julia de referencia, o confirmar que el nombre es aceptable. Ninguna de las dos cosas se hizo
aquí. La cobertura de `IBRSITE_EXT`, NGX y estrellas de extremo a extremo se pierde hasta entonces; los 15 tests
unitarios de `sitios.test.ts` (casos virtuales en línea, sin fixture) siguen cubriendo el análisis.

## Comprobaciones de procedencia

- `grep -rliE "sni|cenace|sddp|ecuador|celec|transelectric"` sobre el paquete y los fixtures de la ref: aciertos en
  los READMEs (que dicen que no hay datos internos), en comentarios de `red-real.ts` y `red-hidro.ts`, y en la etiqueta
  `Ecuador (sistema aislado)` de `red/hidro/sintetico/expected.json`. La etiqueta es una constante del propio lector
  (`red-hidro.ts`) y no es un dato: se conserva, y se señala para revisión.
- Nombres con mayúscula de 6 o más letras de los fixtures cruzados con 400 ficheros de `data/casos/usuario/` de la
  ref: el único acierto de un nombre propio es el de `red/sitios/sintetico` (omitido).
- `grep -rn "CENACE\|\.psr"` sobre los fixtures: sin aciertos. La prueba `the red/ inputs carry no SNI, CENACE or SDDP
  data by name` lo comprueba en cada ejecución.
