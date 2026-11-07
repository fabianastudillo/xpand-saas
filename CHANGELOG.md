# Registro de cambios

Formato por versión. Cada release de GitHub toma sus notas de la sección `## vX.Y.Z` de este fichero.

## v0.1.0

Primera versión de la plataforma XPAND (M0): `apps/web` (sitio, cuentas y «Explorar casos») más el lector del almacén
de casos, en un solo servidor Next. Solo lectura: no escribe nada en el motor ni en xpand.

- **Base:** plantilla open-micro-saas (`saas-plantilla` 43e65a1, MIT) subida a Next 15, React 19 y Tailwind 4, con
  cuentas (next-auth), Prisma + Postgres y administración. Pagos, analítica, soporte y entrada con Google quedan
  apagados mientras no tengan claves: ninguna página falla ni habla con terceros.
- **Seguridad de la plantilla:** las acciones de administración de usuarios y banderas comprueban el rol de
  administrador (antes cualquier sesión podía ascenderse); los enlaces de entrada se montan sobre `AUTH_URL`, no sobre
  la cabecera Host (obligatoria en producción).
- **Arranque:** Next escucha solo en `127.0.0.1:8870` (`XPAND_WEB_PORT`); otra dirección exige `XPAND_PERMITIR_RED=1`.
- **Casos desde un almacén** (`XPAND_ALMACEN`, fuera del repositorio): las rutas `/api/catalogo`, `/api/red`,
  `/api/config` y `/api/sesion` sirven el contrato de `contracts/api`. Solo los sistemas de la lista blanca
  `config/casos-publicos.json` (hoy IEEE-24 e IEEE-118 clásicos) son públicos; un caso interno responde como uno
  inexistente. Errores con la forma única `{ error: { codigo, mensaje } }`.
- **Importador y comparador:** `pnpm importar-casos` llena el almacén desde un checkout de xpand (que solo se lee);
  `pnpm comparar-con-xpand` compara la red y la fila pública del catálogo de cada caso con las de un xpand en marcha,
  con igualdad exacta.
- **Zona IDE «Explorar casos»** (`/casos`, `/casos/<motor>/<sistema>`): layout propio, ES/EN, WCAG 2.2 AA, insignias de
  honestidad y «Problemas» que explica un catálogo vacío, un caso inexistente o ilegible y un almacén no disponible.
  Sigue funcionando sin Postgres.
- **Cliente y contrato:** `@xpand/api` valida contra `contracts/api` también en producción; `@xpand/core` porta a
  TypeScript la construcción de la red de xpand (parcial: ver TODO.md).
- **Release:** `xpand-plataforma-vX.Y.Z.tar.gz` con la salida standalone de Next, `prisma/` (esquema y migraciones),
  `contracts/`, `config/casos-publicos.json` y `README-instalar.md`; sin casos ni `.env`. Se arranca con `node server.js`
  tras `prisma migrate deploy`; `server.js` aplica las mismas reglas de arranque que `pnpm start`.

## Historia previa

El `v0.1.0` anterior de este repositorio (una SPA Vite en `apps/local` servida por xpand) se retiró antes de publicarse: la
interfaz es ahora parte de la app Next. Su tag nunca se creó.
