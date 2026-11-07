#!/usr/bin/env bash
# Empaqueta la build de la interfaz web para publicarla como release (ver .github/workflows/release.yml).
#
#   scripts/package-dist.sh [dist] [salida]
#
# dist    directorio de la build (por defecto apps/ide-spa/dist).
# salida  directorio donde se escriben dist.tar.gz y dist.tar.gz.sha256 (por defecto el directorio actual).
#
# El tarball trae el CONTENIDO de dist en su raíz (index.html, assets/...), sin carpeta envolvente ni
# entradas «./»: así lo acepta scripts/actualizar-ui.sh de xpand. Falla si falta index.html, si hay
# mapas de código fuente (*.map), enlaces simbólicos, enlaces duros o ficheros especiales: no se publican.
#
# Códigos de salida: 0 ok · 1 build incompleta, con mapas, enlaces o ficheros especiales · 64 uso o directorio que falta.
set -euo pipefail

readonly EXIT_BUILD=1
readonly EXIT_USO=64
readonly NOMBRE_TARBALL="dist.tar.gz"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="${1:-$HERE/apps/ide-spa/dist}"
SALIDA="${2:-$PWD}"

error() {
  echo "package-dist: $*" >&2
}

[ "$#" -le 2 ] || {
  error "uso: $0 [dist] [salida]"
  exit "$EXIT_USO"
}
[ -d "$DIST" ] || {
  error "no existe el directorio de la build: $DIST"
  exit "$EXIT_USO"
}
[ -d "$SALIDA" ] || {
  error "no existe el directorio de salida: $SALIDA"
  exit "$EXIT_USO"
}

[ -f "$DIST/index.html" ] || {
  error "falta index.html en la raíz de $DIST"
  exit "$EXIT_BUILD"
}

mapas="$(find "$DIST" -type f -name '*.map')"
if [ -n "$mapas" ]; then
  error "la build contiene mapas de código fuente; no se publican:"
  echo "$mapas" >&2
  exit "$EXIT_BUILD"
fi

# Solo ficheros y directorios: un enlace simbólico o especial podría sacar del tarball algo fuera de dist.
especiales="$(find "$DIST" ! -type f ! -type d)"
if [ -n "$especiales" ]; then
  error "la build contiene enlaces simbólicos o ficheros especiales; no se publican:"
  echo "$especiales" >&2
  exit "$EXIT_BUILD"
fi

# Un enlace duro haría que tar guarde el contenido dos veces como enlace: se rechaza igual.
enlaces_duros="$(find "$DIST" -type f -links +1)"
if [ -n "$enlaces_duros" ]; then
  error "la build contiene enlaces duros (ficheros con más de un nombre); no se publican:"
  echo "$enlaces_duros" >&2
  exit "$EXIT_BUILD"
fi

# Nombres de primer nivel sin «./»: el tarball queda con index.html y assets/ directamente en su raíz.
entradas=()
while IFS= read -r nombre; do
  entradas+=("$nombre")
done < <(cd "$DIST" && ls -A)

tar --owner=0 --group=0 --numeric-owner -czf "$SALIDA/$NOMBRE_TARBALL" -C "$DIST" -- "${entradas[@]}"

# sha256sum escribe la ruta tal como se le pasa: se ejecuta dentro de la salida para que el fichero
# diga solo «<hash>  dist.tar.gz» y el usuario pueda verificarlo con sha256sum -c.
(cd "$SALIDA" && sha256sum "$NOMBRE_TARBALL" > "$NOMBRE_TARBALL.sha256")

echo "empaquetado: $SALIDA/$NOMBRE_TARBALL y $SALIDA/$NOMBRE_TARBALL.sha256"
