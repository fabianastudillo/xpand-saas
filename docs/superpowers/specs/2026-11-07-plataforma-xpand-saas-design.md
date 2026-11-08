# Diseño: plataforma XPAND en xpand-saas

**Fecha:** 2026-11-07 · **Estado:** aprobado; enmendado el 2026-11-07 (P7, plantilla open-micro-saas) · **Autor:** Fabián Astudillo-Salinas (con Claude)
**Sustituye a:** [`2026-11-06-migracion-gui-design.md`](2026-11-06-migracion-gui-design.md) (copia histórica; venía de la rama local `fabian/plan-migracion-gui` de xpand, nunca publicada y borrada el 2026-11-07)
en todo lo que ponía código en xpand. Conserva de ese spec las decisiones de interfaz (§4).

## 1. Objetivo

Construir en `xpand-saas` una plataforma pública que sustituya, para el grupo y después para clientes externos, a la
GUI Julia de xpand. La interfaz nueva ya existe (M0 original, rama `fabian/m0`); falta el servidor que la sirve, los
datos que muestra y los workers que calculan.

## 2. Decisiones del usuario (2026-11-07)

| # | Decisión |
|---|---|
| P1 | **xpand no cambia** por la migración. Solo cambian `xpand-saas` y `xpand-worker`. (Los PR #2 y #3 abiertos en xpand siguen su curso; no forman parte de este diseño.) |
| P2 | **xpand-saas es pública; xpand-worker está detrás de NAT** y es el worker quien abre la conexión hacia la plataforma. |
| P3 | **La plataforma tiene todos los datos** (casos) y se los envía al worker para que calcule. El worker no guarda casos propios. |
| P4 | **De cero en xpand-saas:** servidor, orquestador de workers, protocolo y base de datos. No se copia `xpand/platform` ni `xpand/contracts/protocol`. |
| P5 | **Se reutilizan los lectores TS** ya portados y comparados contra Julia (specs 002 y 003: AMPL `.dat`, MATPOWER `.m`, Red), con sus fixtures de paridad. |
| P6 | **Casos públicos y privados:** los públicos (Garver, IEEE, MATPOWER…) los ve cualquiera; los internos (SNI, CENACE, SDDP) solo miembros autenticados del grupo, en almacenamiento privado, y nunca en fixtures, capturas ni registros. |
| P7 | **Base: open-micro-saas**, desde la copia `~/Projects/github/saas-plantilla` (commit `43e65a1`; upstream product-makers-hub, MIT), como los demás SaaS del autor. Aporta cuentas (next-auth v5), Prisma + Postgres, administración, correo y pagos. Se sube a **Next 15, React 19 y Tailwind 4** para alinear con la interfaz de M0. La interfaz IDE de M0 se monta como **zona de la app Next**. Los WebSocket de workers van en un **proceso Node aparte** (`apps/orchestrator`, M2), porque Next no aloja bien conexiones largas. (Enmienda: sustituye a «Fastify propio».) |
| P8 | **Local primero, nube después** (se mantiene G3): todo corre primero en la máquina del investigador, con el worker local; se despliega cuando M2 funcione. |

## 3. Arquitectura

### 3.1 Repos

```
xpand-saas/                       (pnpm; Node fijado en .nvmrc)
├── packages/ui/                  tokens, componentes y armazón IDE (de M0, sin cambios de fondo)
├── packages/api/                 cliente tipado de la API de la plataforma (de M0; tipos desde contracts/api)
├── packages/core/                lectores TS reutilizados (P5): ampl, matpower, red-*, plan, numeric, sum
├── apps/web/                     app Next (plantilla open-micro-saas): público, cuentas, administración,
│                                 la zona IDE (Explorar casos de M0) y las rutas /api de casos
├── apps/orchestrator/            (M2) proceso Node: WebSocket de workers y cola de trabajos
├── contracts/api/                FUENTE del contrato REST (ya no es copia de xpand)
├── contracts/protocol/           (M2) FUENTE del protocolo plataforma ↔ worker
└── scripts/
    ├── importar-casos            copia casos y metadatos del catálogo desde un checkout de xpand (solo lectura)
    └── comparar-con-xpand        valida/compara la API de la plataforma contra un servidor xpand en marcha

xpand-worker/                     (M2) toma contracts/protocol de xpand-saas; recibe el caso en cada trabajo
xpand/                            sin cambios; sigue siendo la GUI del grupo hasta que la plataforma la sustituya
```

### 3.2 Datos y casos

- **Almacén de casos:** una carpeta por caso con sus ficheros fuente (`.dat`, `.m`, nombres, coordenadas) y un
  `manifiesto.json` con los metadatos del catálogo (motor, sistema, nombre visible, formulaciones, referencias con
  su tecnología, nota, visibilidad `publico` | `interno`). En local es un directorio; en la nube, almacenamiento de
  objetos privado.
- **Importación:** `scripts/importar-casos` lee un checkout de xpand (sin escribir en él) y genera el almacén. Los
  metadatos del catálogo se obtienen ejecutando el Julia de ese checkout en modo lectura (volcado del catálogo a
  JSON), porque el cargador del catálogo no está portado a TS. La visibilidad se decide por una lista explícita de
  sistemas internos; **ante la duda, `interno`**.
- **Lectura:** el servidor construye la red de un caso con `packages/core` y la adapta a la forma del contrato
  `Red` (la que ya consume la interfaz). La adaptación vive en un único módulo con pruebas.
- **Paridad:** `scripts/comparar-con-xpand` pide catálogo y red de los casos públicos a un servidor xpand en marcha
  y a la plataforma, y compara. Se corre a mano antes de cada release (no en CI: necesita Julia y datos).
  Diferencias en cifras = defecto de la plataforma o del lector, nunca se ajustan los datos.

### 3.3 App web (`apps/web`, Next)

- Conserva de la plantilla las zonas pública, de usuario y de administración, la autenticación (next-auth v5 con
  adaptador Prisma) y el resto de servicios; pagos y correo quedan **apagados** mientras no haya claves (sin
  errores ni enlaces rotos).
- La **zona IDE** (`/casos`, `/casos/[motor]/[sistema]`) monta el armazón de `packages/ui` con las pantallas de
  M0 como componentes cliente; el enrutado de React Router se sustituye por el de Next, conservando URLs,
  foco y estado en la URL.
- Rutas de casos como *route handlers* de Next (runtime Node), con las formas que ya consume la interfaz:
  `GET /api/catalogo`, `GET /api/red`, `GET /api/config`, `GET /api/sesion` (esta última, a partir de la sesión de
  next-auth). Cada respuesta se valida contra `contracts/api` en las pruebas.
- Los casos `interno` no aparecen ni se sirven sin sesión de miembro (en M0 no se sirven nunca).
- Errores con forma única `{ error: { codigo, mensaje } }`, sin rutas del disco ni trazas.
- En local escucha en `127.0.0.1`; Postgres con el `docker-compose.yml` de la plantilla.

### 3.4 Workers (M2)

- El worker abre un WebSocket saliente a `/api/workers` y se identifica con un token emitido por la plataforma.
- Un trabajo lleva el caso completo (ficheros del almacén) y los parámetros; el worker devuelve registro en vivo,
  plan y artefactos. El worker no conserva los casos al terminar.
- El protocolo se define de cero en `contracts/protocol` (JSON Schema + ejemplos) con versión negociada en el
  saludo. `xpand-worker` deja de sincronizar el protocolo desde xpand y lo toma de xpand-saas; XpandCore lo sigue
  sincronizando desde xpand (lectura).

### 3.5 Persistencia

Postgres con Prisma, de la plantilla: desde M0 para cuentas y sesiones; en M1 miembros y visibilidad; en M2
workers, trabajos y resultados.

## 4. Interfaz (se conserva del spec anterior)

- **G5 IDE refinado:** explorador del caso, documentos en pestañas, inspector, panel inferior (Problemas /
  Registro / Salida), paleta Ctrl+K, barra de estado breve y veraz.
- **G6 técnico claro (suizo):** IBM Plex incluida en el build (solo `.woff2`), un acento azul, color solo con
  significado (verde certificado, ámbar aviso, rojo error o no certificado), tokens preparados para tema oscuro.
- **Honestidad de resultados:** *NO CERTIFICADO* y *Factible en AC* siempre visibles; nunca se presenta un dato
  como más de lo que es (demanda «dato del caso», referencias con su tecnología).
- **i18n por claves ES/EN; WCAG 2.2 AA;** estado del servidor en TanStack Query, estado de interfaz en la URL.
- Las pantallas de §3.2 del [spec anterior](2026-11-06-migracion-gui-design.md) (Estudio, Plan, Unifilar, Análisis, Reportes…) se reparten en M3+.

## 5. Entregas

| # | Entrega | Resultado |
|---|---|---|
| **M0** | App Next de la plantilla (subida a Next 15/React 19/Tailwind 4) con cuentas, la zona IDE de «Explorar casos» y la API de solo lectura de catálogo y red, **solo casos públicos**. `packages/core` con los lectores y sus fixtures. Contrato propio. Importador y comparador con xpand. Nada toca xpand | Se navegan los casos públicos sin el servidor Julia |
| **M1** | Rol de miembro del grupo sobre las cuentas de la plantilla, casos internos en almacenamiento privado, con pruebas de que no salen en registros ni respuestas anónimas | El grupo ve también sus casos internos |
| **M2** | Protocolo y WebSocket de workers; cambios en xpand-worker para recibir el caso; un trabajo de punta a punta con registro en vivo | Se resuelve un caso con un worker detrás de NAT |
| **M3+** | Estudio → Resolver → Plan → Histórico con etiquetas de honestidad; Unifilar; Análisis; Reportes; Pronóstico; paridad total; despliegue en la nube | Sustituye a la GUI Julia |

## 6. M0 en detalle

### 6.1 Alcance

- **`packages/core`:** copia de `platform/packages/core` de la rama `003-port-red-ts` (repo `TEP/xpand`, remoto
  `personal`, commit `d224586`), con sus pruebas y **solo los fixtures sintéticos o de casos públicos**. Antes de
  copiar se inventarían los fixtures; cualquier dato SNI/CENACE/SDDP se excluye.
- **`apps/web` (Next):** la plantilla importada desde `saas-plantilla` y subida a Next 15/React 19/Tailwind 4,
  con sus pruebas en verde; pagos y correo apagados sin claves; marca y textos de XPAND en la zona pública
  (sin texto de marketing inventado: lo mínimo para identificar la plataforma). La zona IDE con «Explorar casos»
  de M0 sobre el enrutado de Next; las cuatro rutas `/api` de casos como *route handlers*, validadas contra
  `contracts/api`, con caché en memoria de catálogo y redes; el pie dice «Plataforma X · Interfaz Y» (una sola
  versión si coinciden). `pnpm dev` levanta Next en `127.0.0.1`; Postgres (docker compose) se levanta aparte con
  `pnpm db:start`, porque la zona IDE («Explorar casos») no necesita base de datos y así arranca y se prueba sin ella
  (enmienda de la revisión final, ruling R21).
- **La SPA Vite de M0 (`apps/local` → `apps/web` en la Tarea 1 del plan anterior) se retira** cuando la zona IDE
  pase sus pruebas; sus componentes, i18n y e2e se trasladan, no se reescriben.
- **`contracts/api`:** pasa a ser fuente. Se quitan `sync-from-xpand.sh`, el job `contract` de CI y la necesidad de
  `XPAND_REPO_TOKEN` / `XPAND_CONTRACT_REF`. Se conservan las lecciones de la revisión: `nombre` opcional,
  `etiqueta` requerida, ids y `de`/`a` como cadena o entero normalizados en un solo sitio.
- **Scripts:** `importar-casos` y `comparar-con-xpand` (§3.2).
- **Release:** el tag `vX.Y.Z` publica la salida `standalone` de Next (tarball con `node` y Postgres como
  requisitos, más las migraciones de Prisma). Ya no hay `actualizar-ui.sh` en xpand.

### 6.2 Fuera de alcance de M0

Rol de miembro y casos internos, workers y orquestador, resolver y cualquier escritura sobre casos, pagos activos,
traducción de las páginas de la plantilla (siguen en su idioma hasta M1), nube.

### 6.3 Errores

- Caso inexistente → 404 con forma única; la interfaz lo muestra como «caso no encontrado» con enlace al catálogo.
- Lector que falla con un caso → la ruta responde 500 con el código del error del lector, la interfaz lo lleva a
  «Problemas»; el resto del catálogo sigue funcionando.
- Se mantiene §5.3 del [spec anterior](2026-11-06-migracion-gui-design.md) en la interfaz: nada mudo, validación de esquema también en producción.

### 6.4 Pruebas

- `packages/core`: sus suites de paridad tal como vienen de la 003.
- Rutas `/api` de casos: cada una contra `contracts/api` con el almacén de casos públicos de prueba; casos
  `interno` nunca aparecen (prueba explícita); traversal y enlaces simbólicos en el almacén.
- Plantilla: sus pruebas existentes siguen en verde tras la subida de versiones (registro, entrada, perfil,
  administración).
- Zona IDE: lo de M0 (unitarias, e2e con teclado, axe), ahora contra la app real con un almacén de prueba, no
  contra mocks.
- Antes del release: `comparar-con-xpand` sobre todos los casos públicos, sin diferencias en cifras.

### 6.5 Riesgos

- **El cargador del catálogo no está portado:** la importación depende de ejecutar el Julia de xpand. Si el
  volcado cambia, se rehace la importación; portar el catálogo a TS queda para después de M2.
- **La forma de `/api/red` del servidor Julia añade cosas que los lectores no dan** (coordenadas, nombres, reserva,
  filtro por tecnología). El adaptador cubre lo que usa la interfaz de M0; lo demás se añade cuando una pantalla lo
  necesite. El comparador hace visibles las diferencias.
- **Visibilidad mal clasificada** expondría datos internos en M1+: la lista de internos es explícita, el valor por
  defecto es `interno`, y M0 no sirve ninguno.
- **Subir la plantilla de versión** (Next 14→15, React 18→19, Tailwind 3→4, next-auth v5 beta) puede romper
  componentes o la autenticación: se hace en su propia tarea, con sus pruebas, antes de montar nada encima.
- **La 003 no está integrada** en ninguna rama principal: se copia tal cual y su suite debe pasar en xpand-saas
  antes de construir encima.
