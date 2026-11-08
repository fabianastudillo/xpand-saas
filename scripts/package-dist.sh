#!/usr/bin/env bash
# Empaqueta la build de apps/web (salida standalone de Next) como release: xpand-plataforma-v<versión>.tar.gz.
#
#   scripts/package-dist.sh <raíz del repositorio> [salida]
#
# raíz    repositorio ya construido (`pnpm --filter @xpand/web build`): necesita apps/web/.next/standalone.
# salida  directorio donde se escriben el tarball y su .sha256 (por defecto el directorio actual).
# TAG     (variable de entorno, opcional) si está definida debe ser v<versión de apps/web/package.json>.
#
# El tarball trae en su raíz, sin carpeta envolvente ni entradas «./»:
#   server.js (arranque con las reglas de apps/web/scripts/decision-arranque.mjs), decision-arranque.mjs,
#   apps/web/ (server.js de Next, .next/static, public/), node_modules/, prisma/ (esquema y migraciones),
#   contracts/, config/casos-publicos.json, package.json y README-instalar.md.
# Nunca lleva casos, almacén, .env, semillas, mapas de código fuente, enlaces duros ni ficheros especiales. La
# salida standalone usa la disposición de pnpm (node_modules/<paquete> es un enlace a node_modules/.pnpm/...): sin
# esos enlaces Node no encuentra las dependencias de cada paquete. Se aceptan solo enlaces simbólicos relativos que
# existen y resuelven dentro del paquete, y viajan como enlaces; el resto de piezas no puede traer ninguno.
#
# Códigos de salida: 0 ok · 1 build incompleta o con contenido que no se publica · 64 uso, TAG distinto de la
# versión o directorio que falta.
set -euo pipefail

readonly EXIT_BUILD=1
readonly EXIT_USO=64

error() {
  echo "package-dist: $*" >&2
}

[ "$#" -ge 1 ] || {
  error "uso: $0 <raíz del repositorio> [salida]"
  exit "$EXIT_USO"
}
[ "$#" -le 2 ] || {
  error "uso: $0 <raíz del repositorio> [salida]"
  exit "$EXIT_USO"
}
RAIZ="$1"
SALIDA="${2:-$PWD}"
[ -d "$RAIZ" ] || {
  error "no existe el directorio del repositorio: $RAIZ"
  exit "$EXIT_USO"
}
[ -d "$SALIDA" ] || {
  error "no existe el directorio de salida: $SALIDA"
  exit "$EXIT_USO"
}
RAIZ="$(cd "$RAIZ" && pwd)"
SALIDA="$(cd "$SALIDA" && pwd)"

WEB="$RAIZ/apps/web"
STANDALONE="$WEB/.next/standalone"

# Versión: la de apps/web/package.json (la misma que muestra el pie de la interfaz).
leer_version() {
  node -e 'const v = require(process.argv[1]).version; if (typeof v === "string" && v) process.stdout.write(v);' "$1" 2> /dev/null || true
}
VERSION="$(leer_version "$WEB/package.json")"
[ -n "$VERSION" ] || {
  error "apps/web/package.json no tiene versión"
  exit "$EXIT_BUILD"
}
if [ -n "${TAG:-}" ] && [ "$TAG" != "v$VERSION" ]; then
  error "el tag $TAG no coincide con la versión de apps/web/package.json (v$VERSION)"
  exit "$EXIT_USO"
fi

# Versión del CLI de Prisma que la instalación usará para migrar: la que resolvió el lockfile.
PRISMA_VERSION="$(leer_version "$WEB/node_modules/prisma/package.json")"
[ -n "$PRISMA_VERSION" ] || {
  error "no se encuentra prisma instalado en apps/web (¿pnpm install?)"
  exit "$EXIT_BUILD"
}

# Piezas imprescindibles.
for pieza in \
  "$STANDALONE/apps/web/server.js" \
  "$WEB/.next/static" \
  "$WEB/public" \
  "$WEB/prisma/schema.prisma" \
  "$WEB/prisma/migrations" \
  "$WEB/scripts/iniciar-release.mjs" \
  "$WEB/scripts/decision-arranque.mjs" \
  "$RAIZ/contracts" \
  "$RAIZ/config/casos-publicos.json" \
  "$RAIZ/scripts/release/README-instalar.md"; do
  [ -e "$pieza" ] || {
    error "falta ${pieza#"$RAIZ"/} (¿build hecha?)"
    exit "$EXIT_BUILD"
  }
done

rechazar() {
  local motivo="$1" lista="$2"
  error "$motivo; no se publica:"
  echo "$lista" >&2
  exit "$EXIT_BUILD"
}

# Fuentes que se copian tal cual: solo ficheros y directorios, y sin enlaces duros.
FUENTES=("$WEB/.next/static" "$WEB/public" "$WEB/prisma/migrations" "$RAIZ/contracts")
for fuente in "${FUENTES[@]}"; do
  lista="$(find "$fuente" ! -type f ! -type d)"
  [ -z "$lista" ] || rechazar "hay enlaces simbólicos o ficheros especiales en ${fuente#"$RAIZ"/}" "$lista"
done
# La salida standalone sí trae los enlaces simbólicos de pnpm (se comprueban abajo, ya en el paquete).
lista="$(find "$STANDALONE" ! -type f ! -type d ! -type l)"
[ -z "$lista" ] || rechazar "la salida standalone tiene ficheros especiales" "$lista"
for fuente in "$STANDALONE" "${FUENTES[@]}"; do
  lista="$(find "$fuente" -type f -links +1)"
  [ -z "$lista" ] || rechazar "hay enlaces duros (ficheros con más de un nombre)" "$lista"
done

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# -P: los enlaces simbólicos se copian como enlaces. Sin -a: no se conservan propietarios ni enlaces duros.
cp -rP -- "$STANDALONE/." "$STAGE/"
mkdir -p "$STAGE/apps/web/.next" "$STAGE/prisma" "$STAGE/config"
cp -r -- "$WEB/.next/static" "$STAGE/apps/web/.next/static"
rm -rf -- "$STAGE/apps/web/public"
cp -r -- "$WEB/public" "$STAGE/apps/web/public"
cp -- "$WEB/prisma/schema.prisma" "$STAGE/prisma/schema.prisma"
cp -r -- "$WEB/prisma/migrations" "$STAGE/prisma/migrations"
cp -r -- "$RAIZ/contracts/." "$STAGE/contracts/"
cp -- "$RAIZ/config/casos-publicos.json" "$STAGE/config/casos-publicos.json"
cp -- "$WEB/scripts/iniciar-release.mjs" "$STAGE/server.js"
cp -- "$WEB/scripts/decision-arranque.mjs" "$STAGE/decision-arranque.mjs"
printf '{\n  "name": "xpand-plataforma",\n  "version": "%s",\n  "private": true,\n  "type": "module"\n}\n' "$VERSION" > "$STAGE/package.json"
sed -e "s/{{VERSION}}/$VERSION/g" -e "s/{{PRISMA}}/$PRISMA_VERSION/g" \
  "$RAIZ/scripts/release/README-instalar.md" > "$STAGE/README-instalar.md"

# Lo que nunca se publica, sea cual sea su origen.
lista="$(find "$STAGE" -type f -name '*.map')"
[ -z "$lista" ] || rechazar "la build contiene mapas de código fuente" "$lista"
lista="$(find "$STAGE" -name '.env*')"
[ -z "$lista" ] || rechazar "la build contiene ficheros .env" "$lista"
lista="$(find "$STAGE" -name almacen ! -path "$STAGE/contracts/almacen")"
[ -z "$lista" ] || rechazar "la build contiene un almacén de casos" "$lista"
# contracts/almacen/examples/manifiesto.json es el ejemplo público del contrato, no un caso.
lista="$(find "$STAGE" -type f -name 'manifiesto.json' ! -path "$STAGE/contracts/*")"
[ -z "$lista" ] || rechazar "la build contiene manifiestos de casos" "$lista"
lista="$(find "$STAGE" ! -type f ! -type d ! -type l)"
[ -z "$lista" ] || rechazar "el paquete contiene ficheros especiales" "$lista"
# Enlaces simbólicos: relativos, existentes y dentro del paquete (nunca hacia / ni hacia fuera con ..).
malos=""
while IFS= read -r -d '' enlace; do
  texto="$(readlink -- "$enlace")"
  destino="$(readlink -e -- "$enlace" || true)"
  case "$texto:$destino" in
    /*:*) malos+="$enlace -> $texto (absoluto)"$'\n' ;;
    *:"$STAGE"/*) ;;
    *) malos+="$enlace -> $texto (no existe o sale del paquete)"$'\n' ;;
  esac
done < <(find "$STAGE" -type l -print0)
[ -z "$malos" ] || rechazar "el paquete contiene enlaces simbólicos que no se aceptan" "$malos"

# Nombres de primer nivel sin «./»: el tarball queda con server.js, apps/... directamente en su raíz.
entradas=()
while IFS= read -r nombre; do
  entradas+=("$nombre")
done < <(cd "$STAGE" && ls -A)

NOMBRE_TARBALL="xpand-plataforma-v$VERSION.tar.gz"
tar --owner=0 --group=0 --numeric-owner -czf "$SALIDA/$NOMBRE_TARBALL" -C "$STAGE" -- "${entradas[@]}"

# sha256sum escribe la ruta tal como se le pasa: se ejecuta dentro de la salida para que el fichero diga solo
# «<hash>  <tarball>» y se pueda verificar con sha256sum -c.
(cd "$SALIDA" && sha256sum "$NOMBRE_TARBALL" > "$NOMBRE_TARBALL.sha256")

echo "empaquetado: $SALIDA/$NOMBRE_TARBALL y $SALIDA/$NOMBRE_TARBALL.sha256"
