> **Histórico.** Copia literal del commit `b4c853f` de xpand (rama `fabian/plan-migracion-gui`, nunca publicada y
> borrada el 2026-11-07). Sustituido por `2026-11-07-plataforma-xpand-saas-design.md` y `2026-11-07-plataforma-m0.md`;
> se guarda porque el spec vigente toma de él las decisiones de interfaz y remite a sus §3.2 y §5.3. No se ejecuta.

# Diseño: migración y rediseño de la GUI de XPAND

**Fecha:** 2026-11-06 · **Estado:** propuesto · **Autor:** Fabián Astudillo-Salinas (con Claude)
**Relación con otros diseños:** amplía `2026-10-21-xpand-saas-design.md` (S4, S13, §10 Fase 4). Anticipa una
enmienda de S15 (ubicación del código TS) que se hará en su propio spec, en la entrega M7.

## 1. Objetivo

Sustituir la GUI legada (`web/`, unas 56 000 líneas de JS en 33 scripts globales, servida por
`src/servidor.jl` con unas 94 rutas `/api`) por una interfaz nueva, **pensada para la usabilidad**. No tiene que
verse igual que la actual, tiene que verse mejor.

Decisiones del usuario (2026-11-06):

| # | Decisión |
|---|---|
| G1 | La interfaz nueva vive en el repo **`xpand-saas`** (hoy vacío). |
| G2 | Usuarios: **primero el grupo de investigación**, con todas las funciones de la GUI legada; los clientes externos después. |
| G3 | Despliegue: **primero local** (en la máquina de cada investigador), la nube después. |
| G4 | Enfoque: **interfaz nueva sobre la API Julia actual**. El servidor Julia sigue haciendo todo el cálculo; el port del dominio a TS sigue en paralelo y más adelante sustituye rutas sin tocar la interfaz. |
| G5 | Estructura: **IDE refinado**: explorador del caso, documentos centrales, inspector y panel inferior. |
| G6 | Estilo: **técnico claro (suizo)**. |

Éxito = el grupo hace su trabajo diario en la interfaz nueva sin volver a la legada, y la misma interfaz se
puede desplegar después en la nube cambiando solo el armazón: autenticación, equipos y workers.

## 2. Problemas que corrige (de capturas y código, 2026-11-06)

- Dos barras de iconos sin texto, una encima de otra (Plan de expansión).
- Avisos críticos en la barra de estado, en rojo y **cortados**. Ejemplo: el de reserva firme de Garver 6.
- La barra de estado dice «Sin sistema seleccionado» aunque ya hay un sistema elegido.
- El explorador ocupa la columna izquierda incluso en pantallas que no lo usan.
- Un formulario gigante que `web/ventana.js` reparte en pestañas moviendo nodos del DOM. Su orden se ha
  cambiado tres veces a mano.
- Dos selectores de estudio en Análisis: uno visible y otro oculto «(interno)» con más de 20 opciones.
- Gestión de correo y usuarios mezclada con la planificación (columna lateral de Planificar).
- Errores mostrados como texto en un `<pre>` y avisos que desaparecen a los 9 s.
- Progreso de las corridas por sondeo, con un fallo documentado de sondeos duplicados (`web/app.js:4226`).
- Traducción por texto en español, aplicada con un `MutationObserver` sobre todo el DOM.

## 3. Arquitectura

### 3.1 Repos

```
xpand-saas/                      (pnpm; Node fijado en .nvmrc)
├── packages/ui/                 tokens, componentes y armazón IDE (React + Tailwind 4 + shadcn reestilizado)
├── packages/api/                cliente tipado de la API Julia (tipos generados desde contracts/api)
├── apps/local/                  armazón Vite + React Router, compilado como sitio estático con base /app/
├── contracts/api/               COPIA sincronizada de xpand/contracts/api
└── scripts/sync-from-xpand.sh   [--check]

xpand/                           (servidor Julia, fuente del contrato)
├── contracts/api/               un JSON Schema (+ ejemplos) por ruta tipada
├── web/app/                     build estático de xpand-saas, commiteado y fijado en web/app/VERSION
└── scripts/actualizar-ui.sh     vX.Y.Z → descarga el release, verifica el sha256 y escribe web/app/
```

- **Contrato:** la fuente es `xpand/contracts/api/`, porque el servidor vive en xpand. Las pruebas Julia validan
  las respuestas reales contra el esquema. `xpand-saas` guarda una copia y su CI falla si hay deriva
  (`sync-from-xpand.sh --check`, con un token de solo lectura del repo del grupo). Las rutas se tipan a medida
  que su pantalla se migra, no todas de golpe.
- **Empaquetado local:** cada tag `vX.Y.Z` de `xpand-saas` publica `dist.tar.gz` y su sha256 como release.
  En xpand, el build se commitea en `web/app/`, así que los investigadores lo reciben con `git pull`, sin Node
  ni tokens. El servidor Julia sirve `/app/*` como sitio estático y devuelve `index.html` para las rutas de la
  SPA.
- **Convivencia:** la GUI legada sigue en `/` hasta terminar M1. Entonces `/` pasa a la interfaz nueva y la
  legada queda en `/clasica/` hasta M7. Cada pantalla legada que ya tenga sustituta enlaza a la nueva.
- **Sesión:** mismo origen y misma galleta `gtnep_sesion`. La entrada local como administrador por IP sigue
  como está.
- **Progreso:** primero un único hook de sondeo, que corrige los sondeos duplicados. Una ruta SSE en el servidor
  Julia queda para una entrega posterior.
- **Nube (después de M7):** `apps/cloud` (el Next de `platform/`) reutiliza `packages/ui` y `packages/api`, y
  añade autenticación, equipos y workers.

### 3.2 Estructura de la interfaz (IDE refinado)

- **Barra superior:**
  - logo y ruta del caso (*Garver 6 › GTEP*);
  - **una sola barra de acciones con texto**: «▶ Resolver», «Analizar ▾» (AC, DC, OPF, N-1, Icc, P-V),
    «Exportar ▾» e «Importar ▾»;
  - paleta de comandos **Ctrl+K**;
  - idioma y tema dentro de un menú de ajustes.
- **Izquierda: árbol del caso**, con pestañas Caso / Proyecto / Corridas. Se puede plegar y se oculta en las
  vistas que no lo usan.
- **Centro: documentos en pestañas**: Estudio, Red (unifilar), Plan · corrida, Flujo AC, Pronóstico… Puede
  haber varios abiertos y se pueden comparar dos lado a lado. Sustituyen las 7 pestañas fijas de hoy.
- **Derecha: inspector.** Une «Propiedades» y «Ayuda del parámetro»: muestra lo seleccionado o enfocado, con
  unidad, límites y valor por defecto.
- **Abajo: panel plegable** con tres pestañas:
  - **Problemas**: cada aviso o error con su causa, una acción sugerida y un enlace al elemento;
  - **Registro**: log en vivo de las corridas; sustituye la pestaña «Ejecución»;
  - **Salida.**
- **Barra de estado:** solo estado breve y veraz.
- **Estudio:** un formulario único y progresivo (Tipo → Horizonte → Formulación → Sistema → Solver → Opciones),
  con validación en línea y el motivo de cada bloqueo. El resumen y «Resolver» quedan fijos en el inspector.
  Sin asistente modal.

### 3.3 Estilo «técnico claro»

- **Superficies:** fondo claro con una retícula sutil en el lienzo; un solo acento, azul ingeniería.
- **Tipografía:** IBM Plex Sans para el texto e IBM Plex Mono para las cifras, que se alinean, llevan unidad y
  usan la coma decimal del idioma. Las fuentes se incluyen en el build: el uso local funciona sin internet.
- **Color con significado:** verde = certificado, ámbar = aviso, rojo = error o no certificado. No se usa
  color decorativo.
- **Densidad:** normal, más un modo compacto para tablas grandes (SNI, 938 barras).
- **Tema oscuro:** queda para después. Los tokens se definen desde el principio para poder añadirlo.

### 3.4 Reglas transversales

- **Honestidad de resultados** (invariante de diseño del proyecto): *NO CERTIFICADO* y *factible en AC*
  aparecen como insignias visibles con su color. Nunca se ocultan ni se suavizan.
- **Traducción:** por claves, no por texto. ES/EN desde M0.
- **Accesibilidad:** todo se puede hacer con teclado, el foco es visible y el contraste cumple WCAG AA.
- **Diagrama:** el núcleo SVG del unifilar se porta como módulo TS (S4) y se reestiliza en M2. No se redibuja
  desde cero.
- **Sin estado global heredado:** el estado del servidor va en TanStack Query; el estado de la interfaz va en
  la URL (pestaña, caso, documento) y en un store pequeño por función.

## 4. Entregas

Cada entrega tiene su propio spec, plan y PR, y cada una es útil por sí sola. El orden de M2 a M6 se puede
cambiar según el uso del grupo.

| # | Entrega | Resultado |
|---|---|---|
| **M0** | Fundaciones y «Explorar casos» (§5) | Se abre `/app/` y se navegan los casos |
| **M1** | Estudio → Resolver → Registro en vivo → Plan (resumen, adiciones, certificación) → Histórico. Al cerrar, `/` pasa a la interfaz nueva | Uso diario completo |
| **M2** | Unifilar (núcleo de `dibujo.js` en TS), editor de escenarios, importar, derivar, MATPOWER | Editar redes |
| **M3** | Análisis: flujo AC/DC, OPF, N-1, Icc, P-V, multiperiodo | Estudios de red |
| **M4** | Reportes y exportes: PDF, XLSX, SVG, lámina | Entregables |
| **M5** | Pronóstico, Proyectos, comparación | Largo plazo |
| **M6** | DIgSILENT, reducir a transmisión, verificación, campañas y lotes, entrenamiento, asistente | Paridad total |
| **M7** | Retirar `/clasica/`; después, armazón en la nube y traslado de `platform/` a `xpand-saas` (enmienda de S15) | Un solo frontend |

## 5. M0: fundaciones y «Explorar casos»

### 5.1 Alcance

- **Monorepo `xpand-saas`:** pnpm, TypeScript estricto, ESLint, Vitest y Playwright. CI de GitHub Actions con
  lint, tipos, pruebas unitarias, e2e, `sync-from-xpand.sh --check` y, en cada tag, el build y su release.
- **`packages/ui`:**
  - tokens CSS (§3.3);
  - componentes shadcn reestilizados con esos tokens;
  - armazón: `AppShell`, `CaseTree`, `DocumentTabs`, `Inspector`, `BottomPanel` (Problemas / Registro /
    Salida), `CommandPalette`, `StatusBar`;
  - capa de traducción por claves (ES/EN).
- **`packages/api`:**
  - cliente de las rutas de M0, con tipos generados desde `contracts/api`;
  - devuelve un resultado tipado (éxito o error con causa);
  - hooks de TanStack Query;
  - en desarrollo valida cada respuesta contra el esquema y lanza un error explícito si no coincide.
- **`apps/local`:** Vite + React Router con `base: /app/`. Pantalla **«Explorar casos»**:
  - lista del catálogo, con filtros por motor, formulación y tamaño;
  - al elegir un caso: su árbol (barras, líneas existentes y corredores candidatos), su ficha en el inspector y
    sus avisos en «Problemas»;
  - todo de solo lectura.
- **xpand:**
  - `contracts/api/` con los esquemas y ejemplos de `GET /api/catalogo`, `GET /api/red`, `GET /api/config` y
    `GET /api/sesion`;
  - pruebas en `test/runtests.jl` que validan las respuestas reales de Garver 6 contra esos esquemas, con un
    validador JSON Schema como dependencia solo de pruebas;
  - el servidor sirve `/app/*` con respaldo a `index.html`;
  - `scripts/actualizar-ui.sh` y `web/app/VERSION`;
  - en la cabecera de la GUI legada, un enlace «Probar la interfaz nueva».

### 5.2 Fuera de alcance de M0

Resolver y cualquier escritura, el unifilar, el análisis, los reportes, el tema oscuro, SSE y la nube.

### 5.3 Errores

- Si falla la red, el servidor o el tiempo de espera, la entrada va a «Problemas» con la causa y una acción
  posible (reintentar, o comprobar que el servidor está arrancado). No hay errores mudos ni avisos que
  desaparecen solos.
- Si una respuesta no cumple su esquema: error explícito en desarrollo; en producción, aviso en «Problemas» con
  la ruta afectada.

### 5.4 Pruebas

- **Vitest:** el cliente, la conversión de errores y los hooks.
- **Playwright**, contra una API simulada con los ejemplos de `contracts/api`:
  - el flujo «Explorar casos» de principio a fin, solo con teclado;
  - capturas de regresión a 1024 y 1440 px;
  - axe sin violaciones AA.
- **xpand:** pruebas de contrato con Garver 6, más una prueba de que `GET /app/` y `GET /app/casos/x` devuelven
  `index.html`.

### 5.5 Riesgos

- `/api/catalogo` pesa unos 4,1 MB y tarda unos 5 s en construirse. En M0 se consume tal cual, con caché del
  cliente. Si el árbol se nota lento, el primer cambio de contrato será una ruta resumida.
- El build commiteado engorda el historial de xpand. Se mitiga con builds pequeños (presupuesto de unos 300 kB
  de JS comprimido por página) y actualizando solo en releases.
- El CI de `xpand-saas` necesita leer el repo del grupo: hará falta un token de solo lectura como secreto.
