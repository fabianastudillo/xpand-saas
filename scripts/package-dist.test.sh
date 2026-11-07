#!/usr/bin/env bash
# Pruebas de scripts/package-dist.sh sobre una raíz de repositorio falsa con una build falsa de apps/web.
# No usa la build real.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/package-dist.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

FAILURES=0
VERSION="9.8.7"
TARBALL="xpand-plataforma-v$VERSION.tar.gz"

check() {
  local description="$1" ok="$2"
  if [[ "$ok" == "true" ]]; then
    echo "ok   - $description"
  else
    echo "FAIL - $description"
    FAILURES=$((FAILURES + 1))
  fi
}

# crear_raiz <nombre>: repositorio falso con la salida standalone de Next (con un enlace simbólico interno, como
# deja pnpm), .next/static, public, prisma (con una semilla que no debe viajar), contracts, config y los scripts.
crear_raiz() {
  local raiz="$WORK/$1/repo"
  local web="$raiz/apps/web"
  local sa="$web/.next/standalone"
  mkdir -p "$sa/apps/web/.next/server" "$sa/node_modules/.pnpm/next@1/node_modules/next" \
    "$sa/contracts/almacen" "$sa/packages/core" "$web/.next/static/chunks" "$web/public" \
    "$web/prisma/migrations/20240101_a" "$web/prisma/seeds" "$web/scripts" "$web/node_modules/prisma" \
    "$raiz/contracts/api" "$raiz/contracts/almacen" "$raiz/config" "$raiz/scripts/release"
  echo "{\"name\":\"@xpand/web\",\"version\":\"$VERSION\"}" > "$web/package.json"
  echo '{"name":"prisma","version":"5.22.0"}' > "$web/node_modules/prisma/package.json"
  echo "console.log('server')" > "$sa/apps/web/server.js"
  echo "{}" > "$sa/apps/web/package.json"
  echo "html" > "$sa/apps/web/.next/server/index.html"
  echo "{}" > "$sa/package.json"
  echo "next" > "$sa/node_modules/.pnpm/next@1/node_modules/next/index.js"
  ln -s .pnpm/next@1/node_modules/next "$sa/node_modules/next"
  echo "{}" > "$sa/contracts/almacen/manifiesto.schema.json"
  echo "{}" > "$sa/packages/core/package.json"
  echo "chunk" > "$web/.next/static/chunks/a.js"
  echo "<svg/>" > "$web/public/hero.svg"
  echo "generator client {}" > "$web/prisma/schema.prisma"
  echo "create table t();" > "$web/prisma/migrations/20240101_a/migration.sql"
  echo "provider = \"postgresql\"" > "$web/prisma/migrations/migration_lock.toml"
  echo "semilla" > "$web/prisma/seeds/seed.ts"
  echo "export const x = 1;" > "$web/prisma/truncate-db.ts"
  echo "// iniciar" > "$web/scripts/iniciar-release.mjs"
  echo "// decision" > "$web/scripts/decision-arranque.mjs"
  echo "{}" > "$raiz/contracts/api/red.schema.json"
  echo "{}" > "$raiz/contracts/almacen/manifiesto.schema.json"
  echo '{"sistemas":[]}' > "$raiz/config/casos-publicos.json"
  echo "# Instalar v{{VERSION}} con prisma@{{PRISMA}}" > "$raiz/scripts/release/README-instalar.md"
  echo "$raiz"
}

# empaquetar <raiz> <salida> [env...]: ejecuta el script y deja la salida en $WORK/<salida>.out.
empaquetar() {
  local raiz="$1" salida="$2"
  shift 2
  mkdir -p "$salida"
  env "$@" bash "$SCRIPT" "$raiz" "$salida" > "$salida.out" 2>&1
}

# Caso feliz.
RAIZ="$(crear_raiz feliz)"
SALIDA="$WORK/feliz/salida"
empaquetar "$RAIZ" "$SALIDA"
check "empaqueta con exit 0" "$([[ $? -eq 0 ]] && echo true || echo false)"
empaquetar "$RAIZ" "$SALIDA"
check "reejecutar sobre una salida existente da exit 0" "$([[ $? -eq 0 ]] && echo true || echo false)"
check "el tarball se llama xpand-plataforma-v<versión>.tar.gz" "$([[ -f "$SALIDA/$TARBALL" ]] && echo true || echo false)"

NOMBRES="$(tar -tzf "$SALIDA/$TARBALL")"
TOPE="$(sed 's#/.*##' <<<"$NOMBRES" | LC_ALL=C sort -u | paste -sd, -)"
check "entradas de primer nivel exactas (y ninguna más)" \
  "$([[ "$TOPE" == "README-instalar.md,apps,config,contracts,decision-arranque.mjs,node_modules,package.json,packages,prisma,server.js" ]] && echo true || echo "$TOPE")"
check "server.js de Next (apps/web/server.js)" "$(grep -qx 'apps/web/server.js' <<<"$NOMBRES" && echo true || echo false)"
check ".next/static está donde la espera el servidor" "$(grep -qx 'apps/web/.next/static/chunks/a.js' <<<"$NOMBRES" && echo true || echo false)"
check "public/ está donde la espera el servidor" "$(grep -qx 'apps/web/public/hero.svg' <<<"$NOMBRES" && echo true || echo false)"
check "prisma/ trae esquema y migraciones" \
  "$(grep -qx 'prisma/schema.prisma' <<<"$NOMBRES" && grep -qx 'prisma/migrations/20240101_a/migration.sql' <<<"$NOMBRES" && echo true || echo false)"
check "prisma/ no trae semillas ni scripts de mantenimiento" \
  "$(grep -Eq '^prisma/(seeds|truncate-db)' <<<"$NOMBRES" && echo false || echo true)"
check "contracts/api y config/casos-publicos.json" \
  "$(grep -qx 'contracts/api/red.schema.json' <<<"$NOMBRES" && grep -qx 'config/casos-publicos.json' <<<"$NOMBRES" && echo true || echo false)"
check "el enlace simbólico relativo de pnpm viaja como enlace" \
  "$(tar -tvzf "$SALIDA/$TARBALL" | grep -q '^l.* node_modules/next -> \.pnpm/next@1/node_modules/next$' && echo true || echo false)"
check "no hay nada bajo un almacen/ de datos (contracts/almacen es el esquema)" \
  "$(grep -E '(^|/)almacen(/|$)' <<<"$NOMBRES" | grep -Ev '^contracts/almacen/' > /dev/null && echo false || echo true)"
check "ningún .env*" "$(grep -Eq '(^|/)\.env' <<<"$NOMBRES" && echo false || echo true)"
check "ninguna entrada empieza por ./, es absoluta ni tiene .." "$(grep -Eq '^\./|^/|(^|/)\.\.(/|$)' <<<"$NOMBRES" && echo false || echo true)"
check "no hay mapas en el tarball" "$(grep -q '\.map$' <<<"$NOMBRES" && echo false || echo true)"
check "tipos de entrada: solo ficheros, directorios y enlaces simbólicos" "$(tar -tvzf "$SALIDA/$TARBALL" | grep -Ev '^[-dl]' > /dev/null && echo false || echo true)"

CONTENIDO="$WORK/feliz/contenido"
mkdir -p "$CONTENIDO"
tar -xzf "$SALIDA/$TARBALL" -C "$CONTENIDO"
check "README-instalar lleva la versión y la de prisma" \
  "$(grep -qx "# Instalar v9.8.7 con prisma@5.22.0" "$CONTENIDO/README-instalar.md" && echo true || echo false)"
check "package.json de la raíz declara ESM y la versión" \
  "$(grep -q '"type": *"module"' "$CONTENIDO/package.json" && grep -q "\"version\": *\"$VERSION\"" "$CONTENIDO/package.json" && echo true || echo false)"
check "server.js de la raíz es el arranque con las reglas de decision-arranque" \
  "$(grep -qx '// iniciar' "$CONTENIDO/server.js" && grep -qx '// decision' "$CONTENIDO/decision-arranque.mjs" && echo true || echo false)"

LINEA_SHA="$(cat "$SALIDA/$TARBALL.sha256")"
check "el .sha256 tiene formato «<64 hex>  <tarball>»" "$(grep -Eq "^[0-9a-f]{64}  ${TARBALL//./\\.}\$" <<<"$LINEA_SHA" && echo true || echo false)"
check "sha256sum -c verifica el tarball" "$(cd "$SALIDA" && sha256sum -c "$TARBALL.sha256" > /dev/null 2>&1 && echo true || echo false)"

# Rechazos: no dejan tarball. rechaza <nombre> <descripción> <preparación sobre $RAIZ>
rechaza() {
  local nombre="$1" descripcion="$2" preparar="$3"
  local raiz salida
  raiz="$(crear_raiz "$nombre")"
  salida="$WORK/$nombre/salida"
  (cd "$raiz" && eval "$preparar")
  empaquetar "$raiz" "$salida"
  local codigo=$?
  check "$descripcion: exit 1" "$([[ $codigo -eq 1 ]] && echo true || echo false)"
  check "$descripcion: no deja tarball" "$([[ -z "$(ls -A "$salida")" ]] && echo true || echo false)"
}

rechaza conmapa "con un .map en la build" 'echo "{}" > apps/web/.next/standalone/apps/web/.next/server/a.js.map'
rechaza conmapastatic "con un .map en .next/static" 'echo "{}" > apps/web/.next/static/chunks/a.js.map'
rechaza sinserver "sin server.js" 'rm apps/web/.next/standalone/apps/web/server.js'
rechaza sinstatic "sin .next/static" 'rm -r apps/web/.next/static'
rechaza sinesquema "sin schema.prisma" 'rm apps/web/prisma/schema.prisma'
rechaza sinlista "sin config/casos-publicos.json" 'rm config/casos-publicos.json'
rechaza conenv "con un .env dentro de la build" 'echo "X=1" > apps/web/.next/standalone/apps/web/.env.local'
rechaza conenvpublic "con un .env en public/" 'echo "X=1" > apps/web/public/.env'
rechaza conalmacen "con un almacén de casos dentro de la build" 'mkdir -p apps/web/.next/standalone/almacen/m/s && echo "{}" > apps/web/.next/standalone/almacen/m/s/manifiesto.json'
rechaza conmanifiesto "con un manifiesto.json suelto" 'echo "{}" > apps/web/.next/standalone/packages/core/manifiesto.json'
rechaza simbolicofuera "con un enlace simbólico que sale de la build" 'ln -s /etc/hostname apps/web/.next/standalone/node_modules/fuera'
rechaza simbolicorelfuera "con un enlace simbólico relativo que sale del paquete" 'ln -s ../../../../../../../../etc/hostname apps/web/.next/standalone/node_modules/fuera'
rechaza simbolicocolgante "con un enlace simbólico que no existe" 'ln -s no-existe apps/web/.next/standalone/node_modules/colgante'
rechaza simbolicopublic "con un enlace simbólico en public/" 'ln -s hero.svg apps/web/public/enlace.svg'
rechaza enlaceduro "con un enlace duro" 'ln apps/web/public/hero.svg apps/web/public/copia.svg'
rechaza especial "con un fichero especial (fifo)" 'mkfifo apps/web/public/tuberia'
rechaza sinversion "sin versión en apps/web/package.json" 'echo "{}" > apps/web/package.json'
rechaza sinprisma "sin prisma instalado (versión del CLI desconocida)" 'rm -r apps/web/node_modules/prisma'

# El tag debe ser v<versión>.
RAIZ_TAG="$(crear_raiz tag)"
empaquetar "$RAIZ_TAG" "$WORK/tag/ok" TAG="v$VERSION"
check "TAG igual a v<versión>: exit 0" "$([[ $? -eq 0 ]] && echo true || echo false)"
empaquetar "$RAIZ_TAG" "$WORK/tag/mal" TAG="v0.0.1"
check "TAG distinto de v<versión>: exit 64" "$([[ $? -eq 64 ]] && echo true || echo false)"
check "TAG distinto de v<versión>: no deja tarball" "$([[ -z "$(ls -A "$WORK/tag/mal")" ]] && echo true || echo false)"

# Un nombre que empieza por guion no se confunde con una opción de tar.
RAIZ_G="$(crear_raiz guion)"
echo "x" > "$RAIZ_G/apps/web/public/-guion.txt"
empaquetar "$RAIZ_G" "$WORK/guion/salida"
check "un nombre que empieza por guion se empaqueta" \
  "$(tar -tzf "$WORK/guion/salida/$TARBALL" 2>/dev/null | grep -qx -- 'apps/web/public/-guion.txt' && echo true || echo false)"

# Uso.
bash "$SCRIPT" > /dev/null 2>&1
check "sin argumentos da exit 64" "$([[ $? -eq 64 ]] && echo true || echo false)"
bash "$SCRIPT" "$WORK/no-existe" "$SALIDA" > /dev/null 2>&1
check "raíz inexistente da exit 64" "$([[ $? -eq 64 ]] && echo true || echo false)"
bash "$SCRIPT" "$RAIZ" "$WORK/no-existe" > /dev/null 2>&1
check "salida inexistente da exit 64" "$([[ $? -eq 64 ]] && echo true || echo false)"
bash "$SCRIPT" "$RAIZ" "$SALIDA" extra > /dev/null 2>&1
check "argumento de más da exit 64" "$([[ $? -eq 64 ]] && echo true || echo false)"

if [[ "$FAILURES" -gt 0 ]]; then
  echo "$FAILURES prueba(s) fallida(s)"
  exit 1
fi
echo "todas las pruebas de package-dist pasan"
