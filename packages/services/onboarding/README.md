# onboarding

Servicio del **perfil de bienvenida** (NestJS + MongoDB): guarda lo que el SuperAdmin cuenta justo
después de su primer inicio de sesión, su **teléfono** y **dónde conoció Necto**. Es un servicio
independiente: tiene su propio proceso (puerto `8081`), su propia base de datos (`onboarding`) y su propio
usuario de base de datos.

Contexto de la organización en [`docs/arquitectura.md`](../../../docs/arquitectura.md). El frontend que lo
consume es el módulo [`onboarding`](../../apps/web/modules/app/src/modules/onboarding/README.md).

## Levantar en local

Requiere Node >= 22 y Docker. Los comandos se corren desde la **raíz del repo**.

```bash
# 1. Infraestructura (MongoDB)
cp infra/.env.example infra/.env     # y completa las contraseñas (incluida ONBOARDING_DB_PASSWORD)
npm run db:up

# 2. Servicio
cd packages/services/onboarding
cp .env.example .env                 # y completa MONGODB_URI y JWT_SECRET
npm install
cd ../../..
npm run dev:onboarding               # http://localhost:8081
```

- La contraseña en `MONGODB_URI` debe ser la misma que `ONBOARDING_DB_PASSWORD` en `infra/.env`.
- `JWT_SECRET` debe ser **el mismo valor** que el de `packages/services/super-admin-auth/.env`: este servicio
  valida los tokens que emite ese servicio.
- Si tu volumen de MongoDB ya existía antes de este servicio, `mongo-init` **no vuelve a correr**: crea el
  usuario a mano (o borra el volumen, que **borra los datos**: `docker compose -f infra/docker-compose.yml down -v`):

```bash
docker exec framework-modular-mongo mongosh -u root -p "<MONGO_ROOT_PASSWORD>" --authenticationDatabase admin \
  onboarding --eval "db.createUser({user:'onboarding', pwd:'<ONBOARDING_DB_PASSWORD>', roles:[{role:'readWrite', db:'onboarding'}]})"
```

| Comando (desde la raíz) | Qué hace |
|-------------------------|----------|
| `npm run dev:onboarding` | Servicio con recarga automática. |
| `npm run build:onboarding` | Compila. Luego `npm start` dentro de la carpeta del servicio. |

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|:-----------:|-------------|
| `MONGODB_URI` | Sí | Conexión a la base `onboarding` con el usuario del servicio. |
| `JWT_SECRET` | Sí | Mismo secreto que `super-admin-auth` (mínimo 32 caracteres). Solo **verifica** tokens, nunca los firma. |
| `PORT` | No | Puerto del servicio. Por defecto `8081`. |
| `CORS_ORIGIN` | No | Origen del frontend. Por defecto `http://localhost:6020`. |

Si falta una variable obligatoria o el secreto es débil, el servicio no arranca.

## Contrato HTTP

Todas las rutas del perfil exigen `Authorization: Bearer <token>` con un token de **superadmin** emitido por
`super-admin-auth` (algoritmo HS256). El id del usuario sale siempre del token (`sub`); nunca se manda en el
cuerpo ni en la URL, así nadie puede leer o escribir el perfil de otra cuenta.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/onboarding/profile/me` | Perfil de quien está autenticado. |
| `PUT` | `/onboarding/profile/phone` | Paso 1: guarda el teléfono. |
| `PUT` | `/onboarding/profile/sources` | Paso 2: guarda dónde nos conoció y marca el perfil como completo. |
| `GET` | `/health` | Estado del servicio (sin token). |

Las tres rutas del perfil responden con la misma forma:

```json
{ "phone": "+573001234567", "sources": ["instagram", "family"], "completed": true }
```

- `GET /me` sin perfil guardado responde `200` con `{ "phone": null, "sources": [], "completed": false }` (no es un error).
- `completed` pasa a `true` cuando se guardan los orígenes (paso 2). Antes es `false`.

### Teléfono

```json
{ "phone": "+573001234567" }
```

- Formato **E.164**: `+`, indicativo del país (sin cero inicial) y número; entre 8 y 15 dígitos en total, sin espacios.
  El frontend lo arma con el país elegido y lo que escribe la persona.
- **No se puede repetir entre usuarios.** Si otra cuenta ya usa el número responde `409 Phone number already in use`.
  Un usuario sí puede volver a guardar su propio número o cambiarlo.
- Un índice único en MongoDB lo garantiza aunque dos peticiones lleguen al mismo tiempo (una gana, la otra recibe `409`).
- Límite de **10 peticiones por minuto por IP** (un `409` revela si un número está en uso, por eso no se deja sondear).
- Formato inválido o campos de más: `400`.

### Dónde nos conoció

```json
{ "sources": ["instagram", "family", "other"] }
```

- Valores permitidos: `instagram`, `tiktok`, `facebook`, `youtube`, `whatsapp`, `linkedin`, `family`, `business`, `other`.
- Al menos uno, sin repetidos. Fuera de la lista o campos de más: `400`.
- Requiere haber guardado antes el teléfono; si no, responde `409 Save the phone number first`.
- Volver a llamarlo reemplaza la lista y conserva la fecha en que se completó.

### Errores comunes

| Código | Cuándo |
|--------|--------|
| `400` | Cuerpo inválido. |
| `401` | Sin token, token inválido o vencido, o rol distinto de `superadmin`. |
| `409` | Teléfono en uso por otra cuenta, u orígenes sin teléfono guardado. |
| `429` | Demasiadas peticiones. |

## Datos

Base `onboarding`, colección `onboarding_profiles` (un documento por usuario):

| Campo | Descripción |
|-------|-------------|
| `userId` | Id del superadmin (el `sub` del token). **Único.** |
| `phone` | Teléfono E.164. **Único.** |
| `sources` | Lista de orígenes. Vacía hasta el paso 2. |
| `completedAt` | Fecha en que terminó los dos pasos; `null` mientras tanto. |
| `createdAt`, `updatedAt` | Marcas de tiempo automáticas. |

El servicio **no consulta** a `super-admin-auth` para saber si el usuario existe: confía en la firma del token.

## Estructura

```
src/
├── main.ts                   Arranque, validación global y CORS
├── app.module.ts             Módulo raíz (config, Mongo, límite de peticiones)
├── config/env.validation.ts  Validación de variables de entorno
├── health.controller.ts
├── auth/                     Verificación del token del superadmin (guard)
└── profile/                  Controlador, servicio, DTOs y esquema de Mongo del perfil
```
