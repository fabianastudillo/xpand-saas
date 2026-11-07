# Diseño: plataforma XPAND en xpand-saas

**Fecha:** 2026-11-07 · **Estado:** propuesto · **Autor:** Fabián Astudillo-Salinas (con Claude)
**Sustituye a:** `2026-11-06-migracion-gui-design.md` (rama local `fabian/plan-migracion-gui` de xpand, sin publicar)
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
| P7 | Servidor TS propio (`apps/server`, Fastify). Se descartan Next.js full-stack (rehace la interfaz de M0) y serverless (no encaja con WebSocket largos). |
| P8 | **Local primero, nube después** (se mantiene G3): todo corre primero en la máquina del investigador, con el worker local; se despliega cuando M2 funcione. |

## 3. Arquitectura

### 3.1 Repos

```
xpand-saas/                       (pnpm; Node fijado en .nvmrc)
├── packages/ui/                  tokens, componentes y armazón IDE (de M0, sin cambios de fondo)
├── packages/api/                 cliente tipado de la API de la plataforma (de M0; tipos desde contracts/api)
├── packages/core/                lectores TS reutilizados (P5): ampl, matpower, red-*, plan, numeric, sum
├── apps/web/                     la SPA de M0 (hoy apps/local), servida por apps/server en /
├── apps/server/                  Fastify: estáticos de la SPA, API REST, (M2) WebSocket de workers
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

### 3.3 Servidor (`apps/server`)

- Sirve la SPA en `/` (respaldo a `index.html` para rutas sin extensión) y la API en `/api`.
- Escucha en `127.0.0.1` por defecto. Exponerlo a la red es una decisión de despliegue (M2+), con autenticación.
- Rutas de M0, con las formas que ya consume la interfaz: `GET /api/catalogo`, `GET /api/red`, `GET /api/config`,
  `GET /api/sesion`. Cada respuesta se valida contra `contracts/api` en las pruebas del servidor.
- Los casos `interno` no aparecen ni se sirven sin sesión de miembro (en M0 no hay sesión: no se sirven nunca).
- Errores con forma única `{ error: { codigo, mensaje } }`, sin rutas del disco ni trazas.

### 3.4 Workers (M2)

- El worker abre un WebSocket saliente a `/api/workers` y se identifica con un token emitido por la plataforma.
- Un trabajo lleva el caso completo (ficheros del almacén) y los parámetros; el worker devuelve registro en vivo,
  plan y artefactos. El worker no conserva los casos al terminar.
- El protocolo se define de cero en `contracts/protocol` (JSON Schema + ejemplos) con versión negociada en el
  saludo. `xpand-worker` deja de sincronizar el protocolo desde xpand y lo toma de xpand-saas; XpandCore lo sigue
  sincronizando desde xpand (lectura).

### 3.5 Persistencia (M1+)

Postgres para usuarios, miembros, workers, trabajos y resultados. M0 no tiene base de datos.

## 4. Interfaz (se conserva del spec anterior)

- **G5 IDE refinado:** explorador del caso, documentos en pestañas, inspector, panel inferior (Problemas /
  Registro / Salida), paleta Ctrl+K, barra de estado breve y veraz.
- **G6 técnico claro (suizo):** IBM Plex incluida en el build (solo `.woff2`), un acento azul, color solo con
  significado (verde certificado, ámbar aviso, rojo error o no certificado), tokens preparados para tema oscuro.
- **Honestidad de resultados:** *NO CERTIFICADO* y *Factible en AC* siempre visibles; nunca se presenta un dato
  como más de lo que es (demanda «dato del caso», referencias con su tecnología).
- **i18n por claves ES/EN; WCAG 2.2 AA;** estado del servidor en TanStack Query, estado de interfaz en la URL.
- Las pantallas de §3.2 del spec anterior (Estudio, Plan, Unifilar, Análisis, Reportes…) se reparten en M3+.

## 5. Entregas

| # | Entrega | Resultado |
|---|---|---|
| **M0** | `apps/server` local con la SPA en `/` y la API de solo lectura de catálogo y red, **solo casos públicos**. `packages/core` con los lectores y sus fixtures. Contrato propio. Importador y comparador con xpand. Nada toca xpand | Se navegan los casos públicos sin el servidor Julia |
| **M1** | Usuarios, sesión de miembros (Postgres), casos internos en almacenamiento privado, con pruebas de que no salen en registros ni respuestas anónimas | El grupo ve también sus casos internos |
| **M2** | Protocolo y WebSocket de workers; cambios en xpand-worker para recibir el caso; un trabajo de punta a punta con registro en vivo | Se resuelve un caso con un worker detrás de NAT |
| **M3+** | Estudio → Resolver → Plan → Histórico con etiquetas de honestidad; Unifilar; Análisis; Reportes; Pronóstico; paridad total; despliegue en la nube | Sustituye a la GUI Julia |

## 6. M0 en detalle

### 6.1 Alcance

- **`packages/core`:** copia de `platform/packages/core` de la rama `003-port-red-ts` (repo `TEP/xpand`, remoto
  `personal`, commit `d224586`), con sus pruebas y **solo los fixtures sintéticos o de casos públicos**. Antes de
  copiar se inventarían los fixtures; cualquier dato SNI/CENACE/SDDP se excluye.
- **`apps/server`:** Fastify; estáticos + respaldo SPA; las cuatro rutas; validación contra `contracts/api` en las
  pruebas; caché en memoria de catálogo y redes leídas; `127.0.0.1` por defecto; `pnpm dev` arranca servidor y
  Vite juntos.
- **`apps/web`:** la SPA de M0 renombrada; `base: /`; sin enlace a la GUI legada; el pie dice «Plataforma X ·
  Interfaz Y» (una sola versión si coinciden).
- **`contracts/api`:** pasa a ser fuente. Se quitan `sync-from-xpand.sh`, el job `contract` de CI y la necesidad de
  `XPAND_REPO_TOKEN` / `XPAND_CONTRACT_REF`. Se conservan las lecciones de la revisión: `nombre` opcional,
  `etiqueta` requerida, ids y `de`/`a` como cadena o entero normalizados en un solo sitio.
- **Scripts:** `importar-casos` y `comparar-con-xpand` (§3.2).
- **Release:** el tag `vX.Y.Z` publica el servidor con la SPA compilada (tarball con `node` como requisito). Ya no
  hay `actualizar-ui.sh` en xpand.

### 6.2 Fuera de alcance de M0

Sesión y casos internos, base de datos, workers, resolver y cualquier escritura, nube.

### 6.3 Errores

- Caso inexistente → 404 con forma única; la interfaz lo muestra como «caso no encontrado» con enlace al catálogo.
- Lector que falla con un caso → la ruta responde 500 con el código del error del lector, la interfaz lo lleva a
  «Problemas»; el resto del catálogo sigue funcionando.
- Se mantiene §5.3 del spec anterior en la interfaz: nada mudo, validación de esquema también en producción.

### 6.4 Pruebas

- `packages/core`: sus suites de paridad tal como vienen de la 003.
- `apps/server`: cada ruta contra `contracts/api` con el almacén de casos públicos de prueba; casos `interno` nunca
  aparecen (prueba explícita); respaldo SPA; traversal y enlaces simbólicos en estáticos y en el almacén.
- `apps/web`: lo de M0 (unitarias, e2e con teclado, axe), ahora contra el servidor real con un almacén de prueba,
  no contra mocks.
- Antes del release: `comparar-con-xpand` sobre todos los casos públicos, sin diferencias en cifras.

### 6.5 Riesgos

- **El cargador del catálogo no está portado:** la importación depende de ejecutar el Julia de xpand. Si el
  volcado cambia, se rehace la importación; portar el catálogo a TS queda para después de M2.
- **La forma de `/api/red` del servidor Julia añade cosas que los lectores no dan** (coordenadas, nombres, reserva,
  filtro por tecnología). El adaptador cubre lo que usa la interfaz de M0; lo demás se añade cuando una pantalla lo
  necesite. El comparador hace visibles las diferencias.
- **Visibilidad mal clasificada** expondría datos internos en M1+: la lista de internos es explícita, el valor por
  defecto es `interno`, y M0 no sirve ninguno.
- **La 003 no está integrada** en ninguna rama principal: se copia tal cual y su suite debe pasar en xpand-saas
  antes de construir encima.
