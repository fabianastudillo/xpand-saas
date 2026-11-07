// ¿La peticion viene de esta misma maquina? Un route handler de Next no ve el socket, y la unica pista que Next
// le pasa (X-Forwarded-For) la rellena con `??=`: si el cliente la manda, gana la del cliente. Asi que no se mira
// ninguna cabecera: se decide por la direccion en la que escucha el servidor. Si escucha solo en loopback, toda
// conexion que le llega es de esta maquina (el kernel no entrega en 127.0.0.1/::1 paquetes de fuera).
// scripts/arranque.mjs pasa esa direccion al proceso de Next en XPAND_WEB_HOST. Si escucha en otra direccion
// (XPAND_PERMITIR_RED=1) o no se sabe (Next arrancado sin arranque.mjs), la respuesta es false para todos: nunca un
// falso «local». Limite: un proxy inverso en esta maquina que reenvie trafico de fuera a 127.0.0.1 lo haria pasar
// por local; con proxy, arrancar escuchando en otra direccion.

// Los mismos hosts locales que acepta scripts/arranque.mjs sin XPAND_PERMITIR_RED.
const HOSTS_LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);

export function decidirLocal(env: Readonly<Record<string, string | undefined>>): boolean {
  const host = env.XPAND_WEB_HOST?.trim();
  return host !== undefined && HOSTS_LOOPBACK.has(host);
}
