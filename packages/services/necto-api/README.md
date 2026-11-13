# necto-api

El **backend de Necto**: un **monolito modular** (NestJS + MongoDB). Es **una sola aplicación**: un proceso, un servidor
HTTP en un puerto (`8080`), una conexión a MongoDB, un secreto JWT y un solo arranque y despliegue.

Por dentro está organizado **por capacidad de negocio** (`modules/auth`, `modules/onboarding`...), no por tipo técnico:
al abrir las carpetas se entiende qué hace Necto. Cada módulo es dueño de sus rutas, reglas, datos y persistencia, y
se comunica con los demás solo por su **puerta pública** (`public.ts`). La independencia que se busca es de
responsabilidades y de código, no de procesos. Lo transversal (configuración, base de datos, seguridad, errores, salud)
vive en `platform/`.

Contexto de la organización en [`docs/arquitectura.md`](../../../docs/arquitectura.md).

## Levantar en local

Requiere Node >= 22 y Docker. Los comandos se corren desde la **raíz del repo**.

```bash
# 1. Infraestructura (MongoDB)
cp infra/.env.example infra/.env     # y completa las dos contraseñas
npm run db:up

# 2. Backend
cd packages/services/necto-api
cp .env.example .env                 # y completa MONGODB_URI y JWT_SECRET
npm install
cd ../../..
npm run dev:api                      # http://localhost:8080
```

Para generar los secretos:

```bash
openssl rand -hex 16     # cada contraseña de infra/.env
openssl rand -hex 48     # JWT_SECRET (mínimo 32 caracteres)
```

La contraseña en `MONGODB_URI` debe ser la misma que `SUPER_ADMIN_AUTH_DB_PASSWORD` en `infra/.env` (el usuario y la
base de MongoDB conservan su nombre histórico `super_admin_auth`: renombrar la aplicación no obliga a migrar datos).

| Comando (desde la raíz) | Qué hace |
|-------------------------|----------|
| `npm run db:up` / `npm run db:down` | Levanta / detiene MongoDB. Los datos se conservan en el volumen. |
| `npm run dev:api` | Backend con recarga automática. |
| `npm run build:api` | Compila. Luego `npm start` dentro de la carpeta del backend. |
| `npm run test:api` | Pruebas: servicios de `auth` y `onboarding`, seguridad y reglas de arquitectura. |

Para borrar también los datos y volver a crear las bases y usuarios:
`docker compose -f infra/docker-compose.yml down -v`.

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|:-----------:|-------------|
| `MONGODB_URI` | Sí | Conexión a MongoDB (usuario, contraseña y **nombre de la base**). Hoy la base se llama `super_admin_auth`, su nombre histórico; el código nunca lo menciona. |
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
| `GET` | `/onboarding/profile/me` | Perfil de bienvenida de quien tiene el token (requiere token). |
| `PUT` | `/onboarding/profile/phone` | Onboarding, paso 1: guarda el teléfono (requiere token). |
| `PUT` | `/onboarding/profile/sources` | Onboarding, paso 2: guarda dónde nos conoció (requiere token). |
| `GET` | `/health` | Estado del servicio. |

Los módulos y sus rutas: `auth` (`/auth/super/...`) y `onboarding` (`/onboarding/...`). El contrato de cada uno
está en su sección de abajo.

### Registro

```json
{
  "username": "admin.root",
  "email": "admin@company.com",
  "password": "at-least-8-characters",
  "identityDocumentType": "CC",
  "identityDocument": "1.032.556.778",
  "acceptTerms": true
}
```

- `username`: 3 a 30 caracteres (letras, números, `.`, `-`, `_`). No admite `@`. Se guarda en minúsculas.
- `email`: válido; se guarda en minúsculas.
- `password`: 8 a 72 caracteres. Se guarda como hash bcrypt, nunca en claro.
- `identityDocumentType`: `CC` (cédula de ciudadanía), `CE` (cédula de extranjería), `PA` (pasaporte) o `NIT`. No distingue mayúsculas.
- `identityDocument`: 5 a 20 caracteres (letras, números o guion). Se quitan puntos y espacios.
- `acceptTerms`: debe ser `true`. El servidor guarda la fecha y hora de la aceptación (`termsAcceptedAt`).
- `username` y `email` son únicos. El documento es único **junto con su tipo**: el mismo número puede existir con otro tipo (por ejemplo, una CC y un pasaporte). Si ya existe uno, responde `409`.
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
`PUT /onboarding/profile/phone` acepta 10 por minuto por IP. El resto de rutas, 100 por minuto.

## Módulo onboarding

Guarda lo que el SuperAdmin cuenta justo después de su primer inicio de sesión: su **teléfono** y **dónde conoció
Necto**. El frontend que lo consume es el módulo
[`onboarding`](../../apps/web/modules/app/src/modules/onboarding/README.md).

Todas sus rutas exigen `Authorization: Bearer <token>` con el token de superadmin que emite `POST /auth/super/login`
(se verifica en el mismo proceso con los guards de `platform/security`, sin llamadas entre módulos). El id del usuario sale siempre
del token (`sub`); nunca se manda en el cuerpo ni en la URL, así nadie puede leer o escribir el perfil de otra cuenta.

Las tres rutas responden con la misma forma:

```json
{ "phone": "+573001234567", "sources": ["instagram", "family"], "completed": true }
```

- `GET /onboarding/profile/me` sin perfil guardado responde `200` con `{ "phone": null, "sources": [], "completed": false }` (no es un error).
- `completed` pasa a `true` cuando se guardan los orígenes (paso 2). Antes es `false`.

### Teléfono

`PUT /onboarding/profile/phone`

```json
{ "phone": "+573001234567" }
```

- Formato **E.164**: `+`, indicativo del país (sin cero inicial) y número; entre 8 y 15 dígitos en total, sin espacios.
  El frontend lo arma con el país elegido y lo que escribe la persona.
- **No se puede repetir entre usuarios.** Si otra cuenta ya usa el número responde `409 Phone number already in use`.
  Un usuario sí puede volver a guardar su propio número o cambiarlo.
- Un índice único en MongoDB lo garantiza aunque dos peticiones lleguen al mismo tiempo (una gana, la otra recibe `409`).
- Límite de **10 peticiones por minuto por IP**: un `409` revela si un número está en uso, por eso no se deja sondear.
- Formato inválido o campos de más: `400`.

### Dónde nos conoció

`PUT /onboarding/profile/sources`

```json
{ "sources": ["instagram", "family", "other"] }
```

- Valores permitidos: `instagram`, `tiktok`, `facebook`, `youtube`, `whatsapp`, `linkedin`, `family`, `business`, `other`.
- Al menos uno, sin repetidos. Fuera de la lista o campos de más: `400`.
- Requiere haber guardado antes el teléfono; si no, responde `409 Save the phone number first`.
- Volver a llamarlo reemplaza la lista y conserva la fecha en que se completó.

### Errores comunes del onboarding

| Código | Cuándo |
|--------|--------|
| `400` | Cuerpo inválido. |
| `401` | Sin token, token inválido o vencido. |
| `403` | Token válido de un usuario cuyo rol no es `superadmin`. |
| `409` | Teléfono en uso por otra cuenta, u orígenes sin teléfono guardado. |
| `429` | Demasiadas peticiones. |

### Datos

Colección `onboarding_profiles` (un documento por usuario), en la misma base `super_admin_auth`:

| Campo | Descripción |
|-------|-------------|
| `userId` | Id del superadmin (el `sub` del token). **Único.** |
| `phone` | Teléfono E.164. **Único.** |
| `sources` | Lista de orígenes. Vacía hasta el paso 2. |
| `completedAt` | Fecha en que terminó los dos pasos; `null` mientras tanto. |
| `createdAt`, `updatedAt` | Marcas de tiempo automáticas. |

El módulo **no consulta** la colección `super_admins`: confía en la firma del token para saber quién es el usuario.

## Estructura

```
src/
├── main.ts                      Arranque: validación global de cuerpos y CORS
├── app.module.ts                Registra la plataforma y los módulos de negocio (una línea por módulo)
├── platform/                    Infraestructura transversal, sin reglas de negocio
│   ├── config/                  Lee y valida el entorno (.env) al arrancar
│   ├── database/                La única conexión a MongoDB
│   ├── security/                Tokens, autenticación, autorización por rol y límite de peticiones
│   ├── errors/                  Errores de dominio -> respuestas HTTP
│   └── observability/           GET /health
└── modules/                     Un módulo por capacidad de negocio
    ├── auth/
    │   ├── public.ts            Puerta pública
    │   ├── auth.module.ts
    │   ├── api/                 Controlador y DTOs (validación de la entrada)
    │   ├── application/         Casos de uso: registro, login y perfil
    │   ├── domain/              SuperAdmin, reglas de unicidad, errores y el puerto del repositorio
    │   └── infrastructure/      Esquema de Mongo y repositorio de `super_admins`
    └── onboarding/
        ├── public.ts            Puerta pública
        ├── onboarding.module.ts
        ├── api/                 Controlador y DTOs
        ├── application/         Casos de uso: teléfono (paso 1), orígenes (paso 2) y lectura
        ├── domain/              Perfil, orígenes permitidos, errores y el puerto del repositorio
        └── infrastructure/      Esquema de Mongo y repositorio de `onboarding_profiles`
```

Dentro de un módulo, las capas dependen en una sola dirección: `api` y `infrastructure` -> `application` y `domain`;
`application` -> `domain`; el `domain` no conoce a nadie (solo usa `platform/errors`). El `application` nunca toca Mongoose:
habla con un repositorio abstracto (`domain/*.repository.ts`) que implementa `infrastructure/`.

## Módulos

| Módulo | Responsabilidad | Datos de los que es dueño | Rutas |
|--------|-----------------|---------------------------|-------|
| `auth` | Registro y login del superadmin; emite la sesión | Colección `super_admins` | `/auth/super/*` |
| `onboarding` | Teléfono (único entre usuarios) y dónde conoció Necto el usuario | Colección `onboarding_profiles` | `/onboarding/profile/*` |

- **Puertas públicas.** `modules/<módulo>/public.ts` es lo único que otro código puede importar de un módulo. Hoy exporta
  solo el módulo de Nest (para que `app.module.ts` lo registre): ningún módulo necesita nada de otro, porque la identidad
  del usuario llega desde `platform/security`. Cuando un módulo necesite algo de otro, se agrega a su `public.ts` como
  contrato (un caso de uso o una interfaz exportados), nunca su repositorio, su esquema ni su controlador.
- **Dependencias permitidas.** Un módulo puede depender de `platform/` y, a través de `public.ts`, de otros módulos. Hoy
  `auth` y `onboarding` solo dependen de `platform/`. `platform/` no depende de ningún módulo.
- **Datos.** Hay un único propietario por colección. Los dos módulos comparten la conexión y la base (`super_admin_auth`),
  pero no leen ni escriben las colecciones del otro. El perfil de onboarding apunta al usuario por su id (el de la sesión),
  sin consultar `super_admins`.
- **Sin comunicación por HTTP entre módulos**: si colaboran, es en memoria, con inyección de dependencias y contratos públicos.

## Seguridad: identidad, autorización y reglas de negocio

Son tres cosas distintas y viven en lugares distintos:

| Qué | Dónde | Cómo |
|-----|-------|------|
| **Verificar identidad y sesión** | `platform/security` | `AuthenticationGuard` valida el token (`Authorization: Bearer <jwt>`) con `TokenService` y deja la identidad en la petición. **No mira el rol.** Sin token o token inválido: `401`. |
| **Autorizar por rol** | `platform/security` | `SuperAdminGuard` solo comprueba que la identidad ya autenticada tenga el rol `superadmin`: otro rol, `403`. Se usa con `@SuperAdminOnly()`, que ejecuta los dos guards en orden. |
| **Reglas de negocio** | Cada módulo | Qué rol se le da a quien inicia sesión (`auth`), quién puede usar el onboarding (hoy el controlador declara `@SuperAdminOnly()`), unicidad del teléfono... |

- Los módulos **reciben la identidad** con `@CurrentUser()` (`{ userId, role }`) y nunca ven el token: no se valida dos veces.
- El **secreto JWT** y el formato del token (HS256) están solo en `platform/security` (`SecurityModule`, `TokenService`).
  `JwtModule` no se exporta: ningún módulo firma ni verifica tokens por su cuenta; `auth` pide uno con `tokens.issue(...)`.
- Un token firmado correctamente pero con un rol que no existe se trata como no autenticado (`401`).

## Pruebas

`npm run test:api` (runner nativo de Node con `tsx`; no hace falta MongoDB):

- **Casos de uso** de `auth` y `onboarding` con repositorios en memoria (registro, duplicados, login, teléfono único entre
  usuarios, orden de los pasos, fecha de completado).
- **Seguridad:** emisión y verificación de tokens, `AuthenticationGuard` y `SuperAdminGuard`.
- **Arquitectura** (`src/architecture.spec.ts`): lee los imports reales y comprueba que `platform/` no depende de los
  módulos, que los módulos solo se alcanzan por `public.ts`, que las capas respetan su sentido, que Mongoose solo está en
  `infrastructure` y que `@nestjs/jwt` solo está en `platform/security`, y que no hay ciclos entre archivos ni entre módulos.
  Incluye pruebas con violaciones inventadas para asegurar que las reglas de verdad detectan lo que dicen detectar.

La persistencia real (índices únicos, carrera de dos guardados del mismo teléfono) se verifica contra MongoDB levantando el
backend: no hay pruebas automáticas de integración con base de datos.

## Agregar un módulo

1. Crea `src/modules/<modulo>/` con `<modulo>.module.ts` y `public.ts` (que exporte el módulo). Crea solo las capas que
   tengan una responsabilidad real (`api`, `application`, `domain`, `infrastructure`).
2. Regístralo en `app.module.ts` importándolo desde `./modules/<modulo>/public`.
3. Usa rutas con el prefijo del módulo (`/<modulo>/...`) y colecciones propias con `MongooseModule.forFeature`.
4. Para proteger rutas, importa `SecurityModule` y usa `@SuperAdminOnly()` (o `AuthenticationGuard` si no exige un rol);
   toma la identidad con `@CurrentUser()`.
5. Si necesita algo de otro módulo, importa **solo su `public.ts`**. Si dos módulos necesitan lo mismo, va a `platform/`
   (solo si es transversal y sin reglas de negocio).
6. Documenta su contrato en este README y corre `npm run test:api`: las reglas de arquitectura fallan si algo se rompe.
