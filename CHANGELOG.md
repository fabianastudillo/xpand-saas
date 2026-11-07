# Registro de cambios

Formato por versión. Cada release de GitHub toma sus notas de la sección `## vX.Y.Z` de este fichero.

## v0.1.0

Primera versión de la interfaz nueva de XPAND (M0). Solo lectura: la interfaz consulta el catálogo, la red de un
caso y la configuración del servidor, y no escribe nada en el motor.

- **Aplicación local** (`apps/local`), servida por el servidor de XPAND bajo `/app/`: armazón tipo IDE con árbol,
  documentos, inspector, panel de problemas y paleta de comandos.
- **Explorar casos:** catálogo de motores, sistemas y casos con filtro; al abrir un caso se ve su red y se puede
  seleccionar una barra para consultar su demanda en el inspector.
- **Cliente tipado de la API** (`packages/api`): rutas de M0 (`/api/catalogo`, `/api/red`, `/api/config`,
  `/api/sesion`), validación contra el contrato JSON Schema y errores explícitos (sesión caducada, servidor caído,
  respuesta cortada o cancelada).
- **Sistema de diseño** (`packages/ui`): tokens, componentes base y textos por claves en español e inglés; cifras
  con coma decimal en ES y punto en EN.
- **Contrato sincronizado** (`contracts/api`) desde el repositorio XPAND con `scripts/sync-from-xpand.sh`.
- **Calidad:** ESLint, TypeScript estricto, Vitest, pruebas Playwright con API simulada y comprobaciones de
  accesibilidad (axe).
- **Empaquetado:** `scripts/package-dist.sh` genera `dist.tar.gz` (contenido de la build en su raíz, sin mapas de
  código fuente) y su `.sha256`; el workflow `release` los publica al subir un tag `v*`, tras comprobar que el tag
  es `v<versión de apps/local/package.json>`. Solo se empaquetan fuentes `.woff2`.
- **Ronda final de revisión (07/11/2026):** la validación contra el contrato corre también en producción (una
  respuesta que no cumple es un aviso «schema» con su ruta en «Problemas», nunca un fallo de pantalla); los
  identificadores de barra llegan como cadena o entero según el motor y la interfaz los lee siempre como texto; la
  barra se rotula con `nombre`, si no `etiqueta`, si no su id; la barra de estado dice «Catálogo no disponible»
  cuando falla la carga; las flechas en las pestañas de documentos solo mueven el foco (Enter/Espacio activan) y el
  buscador del catálogo no roba el foco; la fila del catálogo rotula la referencia con su tecnología
  («Referencia (ac): 6212,45»); la demanda del inspector se rotula como dato del caso; el aviso de sesión también
  ofrece reintentar.
