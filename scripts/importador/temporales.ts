// Limpiezas pendientes del importador (carpeta del volcado del catalogo, proceso de Julia, almacen en preparacion)
// que hay que hacer tambien si el proceso recibe SIGINT o SIGTERM: el volcado lleva rutas y nombres de casos internos
// y no debe quedar en el disco.
import { rmSync } from "node:fs";

const SENALES = { SIGINT: 2, SIGTERM: 15 } as const;
const limpiezas: (() => void)[] = [];

/** Registra una limpieza para hacerla ante una senal; devuelve la funcion que la quita del registro (sin hacerla). */
export function registrarLimpieza(limpiar: () => void): () => void {
  limpiezas.push(limpiar);
  return () => {
    const i = limpiezas.indexOf(limpiar);
    if (i !== -1) limpiezas.splice(i, 1);
  };
}

/** Registra una carpeta para borrarla ante una senal. */
export function registrarTemporal(dir: string): () => void {
  return registrarLimpieza(() => {
    rmSync(dir, { recursive: true, force: true });
  });
}

/** Hace las limpiezas en orden inverso (lo ultimo registrado, p. ej. matar a Julia, antes de borrar su carpeta). */
function limpiarTodo(): void {
  for (const limpiar of limpiezas.splice(0).reverse()) {
    try {
      limpiar();
    } catch {
      // seguir con las demas: es lo ultimo que hace el proceso
    }
  }
}

/**
 * Ante SIGINT o SIGTERM hace las limpiezas registradas y llama a `salir(128 + senal)`. Devuelve la funcion que quita
 * los manejadores.
 */
export function instalarLimpiezaEnSenales(salir: (codigo: number) => void = (c) => process.exit(c)): () => void {
  const quitar = Object.entries(SENALES).map(([senal, numero]) => {
    const manejador = () => {
      limpiarTodo();
      salir(128 + numero);
    };
    process.on(senal, manejador);
    return () => process.off(senal, manejador);
  });
  return () => {
    for (const q of quitar) q();
  };
}
