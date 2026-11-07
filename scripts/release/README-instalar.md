# Plataforma XPAND v{{VERSION}}: instalación

Este paquete es la aplicación ya construida (servidor Node autónomo). No trae casos, ni `.env`, ni claves: los pones tú.

## Requisitos

- Linux x86_64 con OpenSSL 3 (el paquete se construye en Ubuntu; el motor de Prisma y `sharp` son de esa plataforma).
- Node 22 o superior.
- Postgres 14 o superior, con una base vacía y un usuario que pueda crear tablas.
- Red durante la instalación: `npx` baja la herramienta de migraciones de Prisma (una vez).

## Instalar

1. Comprueba y desempaqueta (en una carpeta nueva y vacía):

   ```bash
   sha256sum -c xpand-plataforma-v{{VERSION}}.tar.gz.sha256
   mkdir xpand-plataforma && tar -xzf xpand-plataforma-v{{VERSION}}.tar.gz -C xpand-plataforma
   cd xpand-plataforma
   ```

2. Crea un fichero `.env` en esta carpeta (el servidor lo lee; lo que ya esté en el entorno del shell manda):

   ```bash
   DATABASE_URL=postgresql://usuario:clave@127.0.0.1:5432/xpand
   NEXTAUTH_SECRET=<salida de: openssl rand -base64 32>
   AUTH_URL=http://localhost:8870
   XPAND_ALMACEN=/ruta/absoluta/al/almacen
   ```

   `AUTH_URL` es obligatoria: es la URL pública de la app (la que escribe el navegador). El resto de variables
   (`XPAND_WEB_PORT`, `EMAIL_SERVER`, Google, Stripe...) son opcionales; sin claves de terceros esos servicios quedan apagados.

3. Crea las tablas (antes de arrancar y en cada actualización):

   ```bash
   set -a; . ./.env; set +a
   npx --yes prisma@{{PRISMA}} migrate deploy --schema prisma/schema.prisma
   ```

4. Arranca:

   ```bash
   node server.js
   ```

   Escucha en `127.0.0.1:8870`. Para otro puerto, `XPAND_WEB_PORT`. Escuchar en otra dirección (`HOST=0.0.0.0`) exige
   `XPAND_PERMITIR_RED=1`; sin ello el arranque termina con código 64 y lo explica. Detrás de un proxy inverso pon
   `XPAND_MODO_LOCAL=0` y `AUTH_URL` con la URL pública.

## Primer administrador

Crea (o asciende) a tu correo con SQL, una vez:

```sql
INSERT INTO "User" (id, email, name, role)
VALUES (gen_random_uuid()::text, 'tu@correo', 'admin', 'ADMIN')
ON CONFLICT (email) DO UPDATE SET role = 'ADMIN';
```

Para entrar por correo hace falta `EMAIL_SERVER` y `EMAIL_FROM`; con Google, `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.

## Casos

El paquete no incluye casos. «Explorar casos» (`/casos`) lee el almacén de `XPAND_ALMACEN`, que se llena con el
importador del repositorio (`pnpm importar-casos --xpand <checkout de xpand>`). Sin almacén o vacío, la zona muestra
el catálogo vacío y «Problemas» explica cómo importarlos. `config/casos-publicos.json` es la lista blanca: solo esos
sistemas se sirven.
