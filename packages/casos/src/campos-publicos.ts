// Claves de un manifiesto que pueden llegar al catalogo anonimo (/api/catalogo). Las usan el importador (que solo
// escribe estas) y la ruta del catalogo (que solo sirve estas, aunque un manifiesto escrito a mano traiga otras):
// nunca rutas del disco, `origen`, `archivos`, `visibilidad` ni notas internas.

export const CAMPOS_MOTOR_PUBLICOS = ["id", "nombre", "formulacion", "familia", "esquema_red"] as const;

export const CAMPOS_SISTEMA_PUBLICOS = [
  "id",
  "nombre",
  "barras",
  "dificultad",
  "nota",
  "familia",
  "variante",
  "fuente",
  "modelo_datos",
  "tecnologias_datos",
  "referencias",
] as const;

export const CAMPOS_REFERENCIA_PUBLICOS = ["tecnologias", "valor", "crf", "formulacion", "fuente"] as const;

/** Copia de `objeto` con solo las claves de `campos` que trae (sin anadir las ausentes). */
export function soloCampos<T extends object>(objeto: T, campos: readonly string[]): Partial<T> {
  return Object.fromEntries(Object.entries(objeto).filter(([k]) => campos.includes(k))) as Partial<T>;
}
