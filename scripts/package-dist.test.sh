#!/usr/bin/env bash
# Pruebas de scripts/package-dist.sh sobre un directorio dist falso. No usa la build real.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/package-dist.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

FAILURES=0

check() {
  local description="$1" ok="$2"
  if [[ "$ok" == "true" ]]; then
    echo "ok   - $description"
  else
    echo "FAIL - $description"
    FAILURES=$((FAILURES + 1))
  fi
}

# crear_dist <nombre>: build falsa con index.html, assets/ y un fichero de datos; sin mapas.
crear_dist() {
  local dist="$WORK/$1/dist"
  mkdir -p "$dist/assets/fuentes"
  echo "<!doctype html>" > "$dist/index.html"
  echo "console.log(1)" > "$dist/assets/app-abc.js"
  echo "fuente" > "$dist/assets/fuentes/meta.woff2"
  echo "$dist"
}

# Caso feliz: el tarball tiene index.html y assets/ en su raíz, sin «./» ni carpeta envolvente.
DIST="$(crear_dist feliz)"
SALIDA="$WORK/feliz/salida"
mkdir -p "$SALIDA"
bash "$SCRIPT" "$DIST" "$SALIDA" > "$WORK/feliz/out.txt" 2>&1
check "empaqueta con exit 0" "$([[ $? -eq 0 ]] && echo true || echo false)"
bash "$SCRIPT" "$DIST" "$SALIDA" > /dev/null 2>&1
check "reejecutar sobre una salida existente da exit 0" "$([[ $? -eq 0 ]] && echo true || echo false)"

NOMBRES="$(tar -tzf "$SALIDA/dist.tar.gz")"
check "index.html está en la raíz del tarball" "$(grep -qx 'index.html' <<<"$NOMBRES" && echo true || echo false)"
check "assets/ está en la raíz del tarball" "$(grep -q '^assets/' <<<"$NOMBRES" && echo true || echo false)"
check "ninguna entrada empieza por ./" "$(grep -q '^\./' <<<"$NOMBRES" && echo false || echo true)"
check "ninguna entrada es absoluta ni tiene .." "$(grep -Eq '^/|(^|/)\.\.(/|$)' <<<"$NOMBRES" && echo false || echo true)"
check "no hay carpeta envolvente (dist/)" "$(grep -q '^dist/' <<<"$NOMBRES" && echo false || echo true)"
check "no hay mapas en el tarball" "$(grep -q '\.map$' <<<"$NOMBRES" && echo false || echo true)"
check "tipos de entrada: solo ficheros y directorios" "$(tar -tvzf "$SALIDA/dist.tar.gz" | grep -Ev '^[-d]' > /dev/null && echo false || echo true)"

LINEA_SHA="$(cat "$SALIDA/dist.tar.gz.sha256")"
check "el .sha256 tiene formato «<64 hex>  dist.tar.gz»" "$(grep -Eq '^[0-9a-f]{64}  dist\.tar\.gz$' <<<"$LINEA_SHA" && echo true || echo false)"
check "sha256sum -c verifica el tarball" "$(cd "$SALIDA" && sha256sum -c dist.tar.gz.sha256 > /dev/null 2>&1 && echo true || echo false)"

# Un .map en la build hace fallar el empaquetado y no deja tarball nuevo.
DIST_MAPA="$(crear_dist conmapa)"
echo "{}" > "$DIST_MAPA/assets/app-abc.js.map"
SALIDA_MAPA="$WORK/conmapa/salida"
mkdir -p "$SALIDA_MAPA"
bash "$SCRIPT" "$DIST_MAPA" "$SALIDA_MAPA" > "$WORK/conmapa/out.txt" 2>&1
check "con un .map falla con exit 1" "$([[ $? -eq 1 ]] && echo true || echo false)"
check "con un .map no deja tarball" "$([[ ! -e "$SALIDA_MAPA/dist.tar.gz" ]] && echo true || echo false)"

# Sin index.html la build está incompleta.
DIST_SIN="$(crear_dist sinindex)"
rm "$DIST_SIN/index.html"
SALIDA_SIN="$WORK/sinindex/salida"
mkdir -p "$SALIDA_SIN"
bash "$SCRIPT" "$DIST_SIN" "$SALIDA_SIN" > "$WORK/sinindex/out.txt" 2>&1
check "sin index.html falla con exit 1" "$([[ $? -eq 1 ]] && echo true || echo false)"

# Argumentos inexistentes o de más: uso con exit 64.
bash "$SCRIPT" "$WORK/no-existe" "$SALIDA" > /dev/null 2>&1
check "directorio de build inexistente da exit 64" "$([[ $? -eq 64 ]] && echo true || echo false)"
bash "$SCRIPT" "$DIST" "$SALIDA" extra > /dev/null 2>&1
check "argumento de más da exit 64" "$([[ $? -eq 64 ]] && echo true || echo false)"

if [[ "$FAILURES" -gt 0 ]]; then
  echo "$FAILURES prueba(s) fallida(s)"
  exit 1
fi
echo "todas las pruebas de package-dist pasan"
