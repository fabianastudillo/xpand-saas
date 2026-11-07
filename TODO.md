# TODO

Pendientes conocidos que todavía no tienen rama ni PR. Primero los que deja el cierre de M0 (Task 9); después los
menores aparcados de la revisión final.

## Al cerrar M0 (2026-11-07)

- **[HIGH] `construir_red` solo se porta con `tec=ac`.** Falta: las demás tecnologías (hvdc, bancos, statcom, sssc,
  tcsc, svc, bess, ibr, gen/genexp, `menu`, `todos_candidatos`), `_aplicar_coords!` (coords.json: px/py, trazados),
  `_reserva_del_caso`, `_mbase_desde_m!`, `avisos_hash_tablas`, `_marcar_estrellas!` y de geo.json todo menos los
  nombres. La lista exacta está en la cabecera de `packages/casos/src/red.ts`. El comparador solo cubre `tec=ac`.
- **[MEDIUM] Traducir las páginas de la plantilla en M1.** Las páginas del sitio (inicio, precios, entrada, perfil,
  administración, términos y privacidad) siguen en el idioma de la plantilla; la zona IDE ya es ES/EN por claves.
- **[MEDIUM] Pasar el catálogo de casos a TypeScript después de M2.** Hoy el catálogo y los métodos viven en xpand
  (`catalogo.jl`); la plataforma solo lee el almacén que genera el importador.
- **[MEDIUM] Más casos públicos.** Solo hay IEEE-24 e IEEE-118 clásicos; cada caso nuevo necesita una fuente con DOI o
  URL verificable en `config/casos-publicos.json`. Sin ella, no entra.
- **[MEDIUM] El release solo es para Linux x86_64 y la migración baja Prisma de la red.** `README-instalar.md` usa
  `npx prisma@<versión> migrate deploy`; incluir el CLI de Prisma en el tarball (o una imagen de contenedor) quitaría la
  dependencia de red en la instalación y de la plataforma del motor.
- **[LOW] El tarball pesa ~25 MB con la disposición de pnpm.** La salida standalone arrastra `typescript` y ficheros
  de varias versiones; revisar el rastreo (`outputFileTracingExcludes`) si importa el tamaño.
- **[LOW] El job de CI no construye el standalone.** Solo el workflow de release lo construye y empaqueta; un cambio
  que rompa el rastreo se vería recién al subir un tag. Añadir `build` + `package-dist.sh` al job `checks`.

## Menores aparcados de la revisión final de M0 (2026-11-07, ruling R18)

- **[MEDIUM] Fixture `red/sitios/sintetico` omitido de `packages/core`.** Un nombre de central procede de un caso
  interno (FR-009). Regenerarlo en el origen con nombres neutros (y su `expected.json` con el Julia de referencia),
  copiarlo a `packages/core/fixtures/red/sitios/` y quitar su entrada de `OMITIDOS` en `fixtures.test.ts`; así vuelve la
  cobertura de IBRSITE_EXT, NGX y estrellas de extremo a extremo. Ver `packages/core/FIXTURES.md`.
- **[LOW] CI duplicado y sin límites.** `.github/workflows/ci.yml:3-5` corre en `push` y en `pull_request` (cada PR
  del propio repo corre dos veces); sin `concurrency` ni `timeout-minutes`; el informe HTML de Playwright no se sube
  como artefacto cuando falla.
- **[LOW] Dependabot solo vigila `github-actions`.** `.github/dependabot.yml:3`; falta `package-ecosystem: npm` para
  las actualizaciones de seguridad del lockfile.
- **[LOW] El catálogo no muestra `nota` en la fila.** `apps/web/src/ide/features/explorar/CatalogDocument.tsx`
  (`CatalogRow`): el aviso del sistema solo aparece al abrir el caso, como problema «info» (spec §5.1 no exige más).
  Un indicador textual en la fila avisaría antes de abrir (p. ej. que Garver 6 «no es el Garver clásico»).
- **[LOW]** `packages/ui/src/styles/fonts.css` y `apps/web/src/app/(site)/layout.tsx` (next/font/local) apuntan a `../../node_modules/@fontsource/...`: depende de cómo pnpm
  coloca los paquetes; un cambio de hoisting rompería el build. Resolver por especificador de paquete o copiar los
  `.woff2` en el build (revisión de la ronda final de M0).
- **[HIGH] Webhook de Stripe sin implementar.** La plantilla traía `apps/web/src/app/api/webhooks/stripe.ts` al estilo
  Pages Router (NextApiRequest, `micro`), que el App Router no sirve; se borró en la Task 2. Antes de activar los pagos
  hay que escribirlo como `apps/web/src/app/api/webhooks/stripe/route.ts` con `req.text()`, verificación de firma
  obligatoria (`stripe.webhooks.constructEvent`) y 503 si falta `STRIPE_ENDPOINT_SECRET`, y probarlo. También antes:
  los planes de `apps/web/src/config/payments-config.ts` son los de ejemplo de la plantilla (Basic/Pro/Teams, precios
  y `priceId` de relleno) y la sección de precios (`pricing.tsx`) sigue en inglés con «Anual (save %)»; hoy no se ven
  porque `/pricing` es 404 sin claves (ruling R20). Definir los planes reales antes de poner las claves.
- **[MEDIUM] Cabecera Content-Security-Policy en apps/web.** `next.config.js` pone nosniff, X-Frame-Options, Referrer-Policy y
  Permissions-Policy; falta una CSP (exige enumerar los scripts en línea de Next y los terceros cuando se activen).
- **[LOW] Un administrador puede degradarse a sí mismo o al último administrador** (`updateUserRoleAction` sin esa guardia);
  y `session()` de auth-options lanza si la sesión no trae correo. Revisar en M1 con el rol de miembro.
- **[LOW] `tests/utils.ts` espera con `networkidle` + 500 ms**; mejor una condición observable cuando la zona IDE tenga sus
  propias señales de carga.
- **[LOW] `.env` de apps/web sin recarga en caliente en `pnpm dev`.** `scripts/arranque.mjs` carga los ficheros con
  @next/env y el hijo hereda los valores como si vinieran del shell, así que editar `.env.local` con `next dev` en marcha
  no surte efecto hasta reiniciar. Alternativa: decidir con una copia del entorno y lanzar Next con el entorno original.
