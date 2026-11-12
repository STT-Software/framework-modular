# super-admin-auth

Servicio de autenticación del **SuperAdmin** (NestJS + MongoDB). Es un servicio
independiente: tiene su propio proceso, su propia base de datos (`super_admin_auth`)
y su propio usuario de base de datos. El login del admin de un negocio será otro
servicio.

Contexto de la organización en [`docs/arquitectura.md`](../../../docs/arquitectura.md).

## Levantar en local

Requiere Node >= 22 y Docker. Los comandos se corren desde la **raíz del repo**.

```bash
# 1. Infraestructura (MongoDB)
cp infra/.env.example infra/.env     # y completa las dos contraseñas
npm run db:up

# 2. Servicio
cd packages/services/super-admin-auth
cp .env.example .env                 # y completa MONGODB_URI y JWT_SECRET
npm install
cd ../../..
npm run dev:super-admin-auth         # http://localhost:8080
```

Para generar los secretos:

```bash
openssl rand -hex 16     # cada contraseña de infra/.env
openssl rand -hex 48     # JWT_SECRET (mínimo 32 caracteres)
```

La contraseña en `MONGODB_URI` debe ser la misma que `SUPER_ADMIN_AUTH_DB_PASSWORD`
en `infra/.env`.

| Comando (desde la raíz) | Qué hace |
|-------------------------|----------|
| `npm run db:up` / `npm run db:down` | Levanta / detiene MongoDB. Los datos se conservan en el volumen. |
| `npm run dev:super-admin-auth` | Servicio con recarga automática. |
| `npm run build:super-admin-auth` | Compila. Luego `npm start` dentro de la carpeta del servicio. |

Para borrar también los datos y volver a crear las bases y usuarios:
`docker compose -f infra/docker-compose.yml down -v`.

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|:-----------:|-------------|
| `MONGODB_URI` | Sí | Conexión a la base `super_admin_auth` con el usuario del servicio. |
| `JWT_SECRET` | Sí | Secreto para firmar los tokens (mínimo 32 caracteres). |
| `JWT_EXPIRES_IN` | No | Duración del token. Por defecto `1h`. |
| `PORT` | No | Puerto del servicio. Por defecto `8080`. |
| `CORS_ORIGIN` | No | Origen del frontend. Por defecto `http://localhost:6020`. |

Si falta una variable obligatoria o el secreto es débil, el servicio no arranca.

## Contrato HTTP

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/auth/super/register` | Crea un superadmin. |
| `POST` | `/auth/super/login` | Inicia sesión con username o email. Devuelve un JWT. |
| `GET` | `/auth/super/me` | Perfil del superadmin autenticado (requiere `Authorization: Bearer <token>`). |
| `GET` | `/health` | Estado del servicio. |

### Registro

```json
{
  "username": "admin.root",
  "email": "admin@company.com",
  "password": "at-least-8-characters",
  "identityDocument": "1.032.556.778"
}
```

- `username`: 3 a 30 caracteres (letras, números, `.`, `-`, `_`). No admite `@`. Se guarda en minúsculas.
- `email`: válido; se guarda en minúsculas.
- `password`: 8 a 72 caracteres. Se guarda como hash bcrypt, nunca en claro.
- `identityDocument`: 5 a 20 caracteres (letras, números o guion). Se quitan puntos y espacios.
- `username`, `email` e `identityDocument` son únicos. Si ya existe uno, responde `409`.
- Cualquier campo que no esté en la lista se rechaza con `400`.

Respuesta `201`: `{ "id", "username", "email" }`.

### Login

```json
{ "identifier": "admin.root", "password": "at-least-8-characters" }
```

`identifier` es el username o el email (no distingue mayúsculas). Respuesta `200`:

```json
{ "accessToken": "<jwt>", "superAdmin": { "id": "...", "username": "...", "email": "..." } }
```

Credenciales incorrectas responden `401 Invalid credentials`, con el mismo mensaje
y tiempo aunque el usuario no exista.

El token lleva `sub` (id) y `role: "superadmin"`.

### Límite de intentos

`register` y `login` aceptan 5 peticiones por minuto por IP; después responden `429`.
El resto de rutas, 100 por minuto.

## Estructura

```
src/
├── main.ts                  Arranque, validación global y CORS
├── app.module.ts            Módulo raíz (config, Mongo, límite de intentos)
├── config/env.validation.ts Validación de variables de entorno
├── health.controller.ts
├── auth/                    Registro, login y guard del superadmin
└── super-admin/             Esquema de Mongo y acceso a datos
```
