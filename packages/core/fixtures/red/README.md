# Fixtures de Red (feature 003)

Pares de entrada y `expected.json` del esquema de la red unificada (`Red` de
`packages/XpandCore/src/red.jl`). Ambas suites los leen: Julia
(`packages/XpandCore/test/fixtures_test.jl`) y TypeScript
(`platform/packages/core/src/fixtures.test.ts`). El formato neutro está en
`specs/002-port-lectores-ts/contracts/neutral-format.md`, ampliado por la decisión
D2 de la 003 (`specs/003-port-red-ts/contracts/red-format.md`).

## Estructura

```
contracts/fixtures/red/<esquema>/<caso>/
├── expected.json     # salida neutra, generada SOLO desde Julia
└── input.<ext>  o  input/   # la entrada: un archivo, o un directorio del caso
```

Esquemas: `misocp`, `gfmgfl`, `matpower`, `real`, `hidro`, `sitios`. Cada carpeta es una
entrada de `manifest.json` con clave `red/<esquema>/<caso>`, `fuente` y `md5`. Un caso
con varios archivos (`input/`) lleva el MD5 del directorio: el de la concatenación, en
orden lexicográfico de nombre relativo, de las líneas `<nombre>\n<md5 del contenido>\n`.

## Procedencia (Principio II)

Ningún fixture contiene datos SNI, CENACE, SDDP (`*.psr`) ni extractos o derivados de ellos.
La comprobación automática está en `fixtures.test.ts` y en `fixtures_test.jl`.

| Caso | Fuente | Qué ejercita |
|---|---|---|
| `misocp/solo_base` | sintético, escrito para la prueba | base sin tecnologías; sets de la base |
| `misocp/base_mas_tecnologia` | sintético | precedencia base/tecnología (`tec_solar.dat`), conjuntos que se solapan y `set` que reescribe |
| `misocp/base_dinamica_econ` | sintético | `dinamica.dat` (por generador) y `econ.dat` (escalares) junto al base |
| `gfmgfl/sintetico` | sintético | `BUS` con `TP/PD0/QD0/PGM`, `BRANCH` por `(k,i,j)`, `CBUS`, `SGEN`, `CTG` |
| `matpower/sintetico_extensiones` | sintético | `ne_branch` con copias `copia k/n`, `busdc` con un nodo de texto, `branchdc_ne`, `convdc_ne`, `candidate_gen` |
| `matpower/case118` | la de `matpower/case118` de la 002 (por referencia) | red IEEE 118 barras, sin copia (FR-018) |
| `matpower/garver6_hvdc_pm` | la de `matpower/garver6_hvdc_pm` de la 002 (por referencia) | tablas HVDC y de candidatos, sin copia (FR-018) |
| `real/sintetico` | sintético, escrito para la prueba | `red.json` mínimo: barras con y sin nombre, líneas, candidatos |
| `hidro/sintetico` | sintético | `etapas.csv` de tres etapas, centrales hidro y térmicas (cabeceras sin espacios, etapa `1` presente) |
| `sitios/sintetico` | sintético | dos sitios (con `IBRSITE_EXT` y uno inferido), `IBRPAV`, `PUNTOS`, NGX sin `cred`, estrellas |
| `sitios/suma_larga` | sintético | un sitio con 40 puntos: fija el orden de la suma (D1) |

`matpower/case118` y `matpower/garver6_hvdc_pm` reutilizan la entrada de la 002, pero su
`expected.json` es la salida de `red_matpower`, no la de la 002.

## Regla de regeneración

Los `expected.json` salen **solo** de la salida del Julia de referencia, con
`packages/XpandCore/tools/generar_fixtures.jl`. No se editan a mano ni se ajustan para que
TypeScript pase. Un cambio de un `expected.json` exige decisión registrada en la spec de la
003 (Principio I). Regenerar los fixtures de la 002 no cambia ningún byte de sus
`expected.json` (SC-006, comprobado con `git diff --exit-code`).

## Reglas de suma (decisión D1)

Las sumas de `pgmax` y de `cf_calculado` son folds secuenciales de izquierda a derecha,
en el orden del archivo o del vector. TypeScript usa `sumaSecuencial` (`sum.ts`) y no
reordena sumandos. `sitios/suma_larga` fija ese orden con 40 términos.

## Defectos del Julia de referencia (no corregidos aquí)

Confirmados en la auditoría T008 (reproducciones en `specs/003-port-red-ts/spec.md`):

- **D3.1** `_tablas_ibr_sitios` termina una tabla en un `;` entre comillas. Lo usa
  `red_misocp` para `ibr_tpwrs`. **Ningún fixture lo ejercita**: ninguna tabla leída por
  ese lector tiene `;` entre comillas.
- **D3.2** `red_hidro` no recorta espacios en cabeceras ni celdas, y falla si no hay etapa
  `1` o si una cabecera tiene espacios. **Ningún fixture lo ejercita**: el CSV tiene
  cabeceras sin espacios y la etapa `1`.
- **D3.3** `_pnum` convierte en `NaN` un token sin comillas no numérico, también en
  columnas de texto (la cadena `"NaN"`) y en columnas numéricas (0 en silencio). **Ningún
  fixture lo ejercita**: ningún token sin comillas de `IBRSITE`, `IBRPAV` ni
  `IBRSITE_EXT` es no numérico.

Pendiente de decisión del usuario:

- **D1.1** `sum(values(horas))` (`red.jl`, línea 334) depende del orden de un `Dict` solo
  con horas negativas. Los fixtures usan horas no negativas, para las que el resultado no
  depende del orden.

Comportamiento de referencia **congelado**: las pruebas de TypeScript que lo documentan se
llaman `[frozen, D3.n]`. No es aprobado: queda pendiente de la decisión del usuario.

## Límites conocidos del port

- Los tokens `Inf` y `-Inf` sin comillas: Julia los lee como infinitos (`tryparse`), y el
  lector TypeScript (gramática decimal de la 002, `numeric.ts`) los lee como `NaN` o como
  texto. Ningún fixture los contiene.
- El texto de un número en una columna de texto (`string(3.0)` de Julia, `"3.0"`) se
  reproduce para enteros y valores decimales normales. Los exponentes y los números muy
  grandes o pequeños no se reproducen.
- El texto del error de `sitios_error` (en `red_misocp`) no es idéntico al de Julia. Solo
  aparece si `ibr_sitios.dat` es ilegible.
