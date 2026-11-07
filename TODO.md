# TODO

Pendientes conocidos que todavía no tienen rama ni PR.

## Menores aparcados de la revisión final de M0 (2026-11-07, ruling R18)

- **[LOW] 404 de `/api/red` con «Reintentar».** `apps/ide-spa/src/app/apiProblems.ts:43` trata todo `http` igual; para
  `/casos/<motor>/<sistema que no existe>` «Problemas» dice «/api/red respondió HTTP 404 · Reintentar», y
  reintentar no sirve. Propuesta: para 400/404/500 de `/api/red` con un caso desconocido, texto «caso no
  encontrado» con enlace al catálogo (comprobar qué código devuelve `api_red` de xpand para un sistema desconocido:
  `error_resp` por defecto es 400).
- **[LOW] CI duplicado y sin límites.** `.github/workflows/ci.yml:3-5` corre en `push` y en `pull_request` (cada PR
  del propio repo corre dos veces); sin `concurrency` ni `timeout-minutes`; el informe HTML de Playwright no se sube
  como artefacto cuando falla.
- **[LOW] Dependabot solo vigila `github-actions`.** `.github/dependabot.yml:3`; falta `package-ecosystem: npm` para
  las actualizaciones de seguridad del lockfile.
- **[LOW] El catálogo no muestra `nota` en la fila.** `apps/ide-spa/src/features/explorar/CatalogDocument.tsx`
  (`CatalogRow`): el aviso del sistema solo aparece al abrir el caso, como problema «info» (spec §5.1 no exige más).
  Un indicador textual en la fila avisaría antes de abrir (p. ej. que Garver 6 «no es el Garver clásico»).
- **[LOW]** `packages/ui/src/styles/fonts.css` apunta a `../../node_modules/@fontsource/...`: depende de cómo pnpm
  coloca los paquetes; un cambio de hoisting rompería el build. Resolver por especificador de paquete o copiar los
  `.woff2` en el build (revisión de la ronda final de M0).
