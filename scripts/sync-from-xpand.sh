#!/usr/bin/env bash
# Mantiene la copia del contrato de la API sincronizada con su origen en el repo xpand.
#
#   scripts/sync-from-xpand.sh          copia desde xpand (sobrescribe lo que difiere)
#   scripts/sync-from-xpand.sh --check  no escribe nada; sale con 1 si hay diferencias
#
# XPAND_SRC: raiz del repo xpand (por defecto ../xpand).
# Codigos de salida: 0 sincronizado, 1 diferencias (--check), 2 no se encuentra el origen,
# 64 argumentos no reconocidos (no se toca nada).
#
set -euo pipefail

readonly USAGE_EXIT=64
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${XPAND_SRC:-$HERE/../xpand}"

# Falla cerrado: cualquier argumento distinto de exactamente --check (o ninguno) es un error.
if (( $# > 1 )); then
  echo "uso: $0 [--check]" >&2
  exit "$USAGE_EXIT"
fi
case "${1:-}" in
  "") MODE="sync" ;;
  --check) MODE="check" ;;
  *) echo "uso: $0 [--check]" >&2; exit "$USAGE_EXIT" ;;
esac

[[ -d "$SRC/contracts/api" ]] || { echo "no encuentro el repo xpand en: $SRC" >&2; exit 2; }

# Ficheros compartidos con xpand. Solo se sincroniza lo que xpand sigue siendo dueno.
SHARED=(
  contracts/api
)

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP" "${STAGE_DIRS[@]:-}"' EXIT
STAGE_DIRS=()
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

# Sincronizacion atomica: se copia junto al destino y se intercambia con mv, de modo que el destino
# nunca queda a medias y nada se borra antes de que la copia nueva este completa.
for p in "${SHARED[@]}"; do
  target="$HERE/$p"
  parent="$(dirname "$target")"
  name="$(basename "$target")"
  mkdir -p "$parent"
  stage="$(mktemp -d "$parent/.sync-XXXXXX")"
  STAGE_DIRS+=("$stage")
  cp -R "$EXP/$p" "$stage/$name"
  if [[ -e "$target" ]]; then
    mv "$target" "$stage/previo"
  fi
  mv "$stage/$name" "$target"
done
echo "sincronizado desde $SRC"
