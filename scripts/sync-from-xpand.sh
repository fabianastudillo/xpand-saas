#!/usr/bin/env bash
# Mantiene la copia del contrato de la API sincronizada con su origen en el repo xpand.
#
#   scripts/sync-from-xpand.sh          copia desde xpand (sobrescribe lo que difiere)
#   scripts/sync-from-xpand.sh --check  no escribe nada; sale con 1 si hay diferencias
#
# XPAND_SRC: raiz del repo xpand (por defecto ../xpand).
# Codigos de salida: 0 sincronizado, 1 diferencias (--check), 2 no se encuentra el origen.
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${XPAND_SRC:-$HERE/../xpand}"
MODE="sync"
[[ "${1:-}" == "--check" ]] && MODE="check"

[[ -d "$SRC/contracts/api" ]] || { echo "no encuentro el repo xpand en: $SRC" >&2; exit 2; }

# Ficheros compartidos con xpand. Solo se sincroniza lo que xpand sigue siendo dueno.
SHARED=(
  contracts/api
)

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
EXP="$TMP/expected"
mkdir -p "$EXP"

for p in "${SHARED[@]}"; do
  mkdir -p "$EXP/$(dirname "$p")"
  cp -R "$SRC/$p" "$EXP/$p"
done

if [[ "$MODE" == "check" ]]; then
  : > "$TMP/diff.txt"
  for p in "${SHARED[@]}"; do
    diff -rq "$EXP/$p" "$HERE/$p" >>"$TMP/diff.txt" 2>&1 || true
  done
  if [[ ! -s "$TMP/diff.txt" ]]; then
    echo "OK: sincronizado con $SRC"
    exit 0
  fi
  echo "DIFERENCIAS con $SRC:"; cat "$TMP/diff.txt"
  exit 1
fi

for p in "${SHARED[@]}"; do
  rm -rf "$HERE/$p"
  mkdir -p "$HERE/$(dirname "$p")"
  cp -R "$EXP/$p" "$HERE/$p"
done
echo "sincronizado desde $SRC"
