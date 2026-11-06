#!/usr/bin/env bash
# Pruebas de scripts/sync-from-xpand.sh. Trabajan sobre una copia temporal del repo y un origen falso,
# nunca sobre el contracts/api real.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

FAILURES=0
SCRIPT_REL="scripts/sync-from-xpand.sh"

# Crea un repo temporal con el script y un contracts/api propio, y un origen xpand falso con otro contenido.
make_fixture() {
  local name="$1"
  local root="$WORK/$name"
  mkdir -p "$root/scripts" "$root/contracts/api/examples" "$root/xpand/contracts/api/examples"
  cp "$REPO_ROOT/$SCRIPT_REL" "$root/$SCRIPT_REL"
  echo "local" > "$root/contracts/api/red.schema.json"
  echo "local" > "$root/contracts/api/examples/red.json"
  echo "origen" > "$root/xpand/contracts/api/red.schema.json"
  echo "origen" > "$root/xpand/contracts/api/examples/red.json"
  echo "$root"
}

# run <root> <args...>: ejecuta el script copiado con XPAND_SRC del fixture y devuelve su codigo.
run() {
  local root="$1"; shift
  XPAND_SRC="$root/xpand" bash "$root/$SCRIPT_REL" "$@" >"$root/out.txt" 2>&1
}

check_exit() {
  local description="$1" expected="$2" actual="$3"
  if [[ "$actual" -eq "$expected" ]]; then
    echo "ok   - $description (exit $actual)"
  else
    echo "FAIL - $description: esperado exit $expected, obtenido $actual"
    FAILURES=$((FAILURES + 1))
  fi
}

check_file_content() {
  local description="$1" file="$2" expected="$3"
  if [[ -f "$file" && "$(cat "$file")" == "$expected" ]]; then
    echo "ok   - $description"
  else
    echo "FAIL - $description: $file no tiene el contenido esperado"
    FAILURES=$((FAILURES + 1))
  fi
}

# 1. Argumento desconocido: exit 64 y no se borra ni se modifica nada.
root="$(make_fixture unknown-flag)"
run "$root" --chek; code=$?
check_exit "argumento desconocido --chek sale con 64" 64 "$code"
check_file_content "argumento desconocido no toca red.schema.json" "$root/contracts/api/red.schema.json" "local"
check_file_content "argumento desconocido no toca examples/red.json" "$root/contracts/api/examples/red.json" "local"

# 2. Mas de un argumento: exit 64.
root="$(make_fixture extra-arg)"
run "$root" --check extra; code=$?
check_exit "--check con argumento extra sale con 64" 64 "$code"

# 3. Sin argumentos: sincroniza (exit 0) y deja la copia igual al origen.
root="$(make_fixture sync)"
run "$root"; code=$?
check_exit "sincronizar sin argumentos sale con 0" 0 "$code"
check_file_content "sincronizar copia red.schema.json del origen" "$root/contracts/api/red.schema.json" "origen"
check_file_content "sincronizar copia examples/red.json del origen" "$root/contracts/api/examples/red.json" "origen"
if [[ -n "$(find "$root/contracts" -name '.sync-*' -print -quit)" ]]; then
  echo "FAIL - sincronizar deja directorios temporales de staging"
  FAILURES=$((FAILURES + 1))
else
  echo "ok   - sincronizar no deja directorios temporales"
fi

# 4. --check con el contenido ya sincronizado: exit 0.
run "$root" --check; code=$?
check_exit "--check tras sincronizar sale con 0" 0 "$code"

# 5. --check con diferencias: exit 1 y no escribe nada.
root="$(make_fixture diff)"
run "$root" --check; code=$?
check_exit "--check con diferencias sale con 1" 1 "$code"
check_file_content "--check con diferencias no escribe" "$root/contracts/api/red.schema.json" "local"

# 6. Origen inexistente: exit 2.
root="$(make_fixture missing-source)"
rm -rf "$root/xpand"
run "$root" --check; code=$?
check_exit "origen inexistente sale con 2" 2 "$code"

if (( FAILURES > 0 )); then
  echo "$FAILURES prueba(s) fallida(s)"
  exit 1
fi
echo "todas las pruebas de sync-from-xpand pasan"
