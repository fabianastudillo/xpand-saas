import type { AppMessageKey, Translate } from "../../i18n/messages";

/**
 * The values of the catalog's `dificultad` field, as the server's catalog defines them (medio, pesado, rapido).
 * contracts/api/catalogo.schema.json declares it as a free string, so an unknown value is shown as it arrives.
 */
const DIFFICULTY_KEYS: Readonly<Record<string, AppMessageKey>> = {
  rapido: "difficulty.fast",
  medio: "difficulty.medium",
  pesado: "difficulty.heavy",
};

/** The effort hint of a system, or null when the catalog gives none. */
export function difficultyLabel(value: string | undefined, translate: Translate): string | null {
  if (value === undefined || value === "") return null;
  const key = DIFFICULTY_KEYS[value];
  return key === undefined ? value : translate(key);
}
