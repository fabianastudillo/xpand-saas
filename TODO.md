# TODO

Pendientes conocidos que todavía no tienen rama ni PR.

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
  obligatoria (`stripe.webhooks.constructEvent`) y 503 si falta `STRIPE_ENDPOINT_SECRET`, y probarlo.
- **[MEDIUM] Cabecera Content-Security-Policy en apps/web.** `next.config.js` pone nosniff, X-Frame-Options, Referrer-Policy y
  Permissions-Policy; falta una CSP (exige enumerar los scripts en línea de Next y los terceros cuando se activen).
- **[LOW] Un administrador puede degradarse a sí mismo o al último administrador** (`updateUserRoleAction` sin esa guardia);
  y `session()` de auth-options lanza si la sesión no trae correo. Revisar en M1 con el rol de miembro.
- **[LOW] `tests/utils.ts` espera con `networkidle` + 500 ms**; mejor una condición observable cuando la zona IDE tenga sus
  propias señales de carga.
- **[LOW] `.env` de apps/web sin recarga en caliente en `pnpm dev`.** `scripts/arranque.mjs` carga los ficheros con
  @next/env y el hijo hereda los valores como si vinieran del shell, así que editar `.env.local` con `next dev` en marcha
  no surte efecto hasta reiniciar. Alternativa: decidir con una copia del entorno y lanzar Next con el entorno original.
