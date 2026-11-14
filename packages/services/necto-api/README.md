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
| `OTP_SECRET` | Sí | Secreto para firmar los códigos de acceso (HMAC). Mínimo 32 caracteres y **distinto** de `JWT_SECRET`. |
| `PUBLIC_APP_URL` | No | Dirección pública del frontend; el correo enlaza a `<PUBLIC_APP_URL>/business/access?business=<id>`. Por defecto `http://localhost:6020`. |
| `OTP_*` | No | Vigencia, intentos y límites de los códigos (TTL 10 min, 5 intentos por código, 60 s entre códigos, 10 intentos por persona+negocio y 30 por IP cada 15 min, 5 envíos por persona+negocio y 20 por IP cada hora). Lista completa y comentada en `.env.example`. |
| `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT`, `MAIL_SMTP_SECURE`, `MAIL_SMTP_REQUIRE_TLS`, `MAIL_SMTP_USER`, `MAIL_SMTP_PASS`, `MAIL_FROM` | No | Proveedor SMTP. **Sin `MAIL_SMTP_HOST` no se puede enviar ningún correo**: el negocio se crea igual y la invitación queda `failed` con `not-configured`. |

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
| `GET` | `/businesses/catalog` | Catálogo de módulos y categorías (superadmin). |
| `GET` / `POST` | `/businesses` | Lista los negocios del superadmin / crea uno con su jefe y módulos (requiere cabecera `Idempotency-Key`). |
| `GET` / `PUT` | `/businesses/:id` | Ficha / edición (perfil, módulos y jefe) conservando el id. |
| `POST` | `/businesses/:id/pause` y `/resume` | Pausa o reanuda el negocio. |
| `GET` | `/businesses/export.csv` | Exporta los negocios del superadmin (neutraliza fórmulas). |
| `GET` | `/businesses/:businessId/invitation` | Estado de la invitación al jefe. |
| `POST` | `/businesses/:businessId/invitation/resend` | Envía un código nuevo al jefe vigente. |
| `POST` | `/business-access/otp/request` | Pide un código de acceso por correo. Responde `202` siempre igual. |
| `POST` | `/business-access/otp/verify` | Canjea el código y devuelve la sesión del jefe. |
| `GET` | `/business-access/me` | Negocio y jefe de la sesión (requiere token de jefe). |
| `GET` | `/health` | Estado del servicio. |

Los módulos y sus rutas: `auth` (`/auth/super/...`), `onboarding` (`/onboarding/...`), `businesses` (`/businesses/...`) y
`business-access` (`/business-access/...` y la invitación en `/businesses/:id/invitation`). El contrato de cada uno
está en su sección de abajo.

Los errores de validación (`400`) traen `message` (lista de textos) y `fields` (`{ "boss.email": ["..."] }`, con la ruta
del campo) para que el formulario marque cada campo.

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

## Módulo businesses

Negocios reales y persistidos, con su jefe y los módulos habilitados. Todas las rutas son `@SuperAdminOnly()` y **solo ven
los negocios de quien los creó** (un negocio ajeno responde `404`, igual que uno inexistente).

- **Catálogo.** Módulos: `reservas`, `turnos`, `agendamiento`, `referidos`, `inventario`, `pedidos` (de 0 a 6, sin repetir,
  identificador desconocido = `400`). Categorías: `gastronomy`, `retail`, `professional-services`, `health-wellness`,
  `other` (esta exige `categoryOther`). Moneda `COP` y zona `America/Bogota` por defecto.
- **Crear (`POST /businesses`).** Exige `Idempotency-Key` (8 a 64 caracteres `A-Za-z0-9_-`). Con la misma clave y la misma
  solicitud devuelve el mismo negocio (`200`, sin segundo evento ni segundo correo); con la misma clave y otra solicitud, `409`.
  El doble clic no duplica: lo garantiza el índice único `{ ownerId, idempotencyKey }`.
- **Un jefe vigente.** El jefe vive **dentro** del documento del negocio (`boss` + `bossHistory`), así un único guardado
  atómico asegura "exactamente un jefe" (MongoDB local es standalone, sin transacciones). El mismo correo puede ser jefe de
  varios negocios.
- **Editar (`PUT /businesses/:id`).** Si cambia el correo del jefe (normalizado), se crea una asignación nueva, la anterior
  pasa al historial y se publica `BossAssigned`; si solo cambia el nombre, no se invita de nuevo. Guarda con control de
  concurrencia por `version` (dos escrituras simultáneas: la perdedora recibe `409`).
- **Pausar / reanudar.** Un negocio pausado bloquea al jefe (sesión `403`, no recibe códigos).
- **Ficha.** Resumen, módulos y equipo; `summary.hasActivity` es `false` (no se inventan métricas). Nunca expone códigos,
  hashes ni secretos.
- **Puerta pública** (`public.ts`): `BusinessDirectory` (consulta de un negocio y su jefe vigente), el evento `BossAssigned`
  y `BusinessModuleAccess` (para que un módulo futuro compruebe en el servidor si un módulo está habilitado).

Datos: colección `businesses`, índices `{ ownerId, idempotencyKey }` (único), `{ ownerId, createdAt }` y
`{ ownerId, status, category }`.

## Módulo business-access

Acceso del jefe **sin contraseña**: un código de 6 dígitos por correo.

- **Invitación.** Al crear un negocio (o reemplazar al jefe), `businesses` publica `BossAssigned` y este módulo envía el
  primer código. `business-access` depende de `businesses/public`, nunca al revés (sin ciclos).
- **Código.** Aleatorio (`crypto.randomInt`), se guarda solo su HMAC-SHA256 atado a negocio, asignación, correo y propósito;
  se compara en tiempo constante. Vence a los 10 min, admite 5 intentos y se canjea **una sola vez** (si llegan dos
  verificaciones simultáneas, solo una gana). Pedir un código nuevo invalida el anterior.
- **Respuestas que no filtran información.** `request` responde `202` igual exista o no el correo/negocio, esté pausado o no;
  `verify` responde siempre el mismo `401 Invalid or expired code` (código errado, vencido, usado, de otro negocio o de un
  jefe reemplazado). Las únicas respuestas visibles distintas son `429` con `Retry-After`.
- **Límites** (en MongoDB, ventana fija; cada solicitud cuenta aunque sea rechazada): por persona+negocio y por IP, tanto
  para intentos como para envíos. Pedir códigos nuevos no reinicia los intentos.
- **Sesión del jefe.** Token con `role: business-boss`, `businessId` y `assignmentId`. `BusinessBossGuard` lo valida contra la
  base **en cada petición**: jefe reemplazado `401`, negocio pausado `403`, token de superadmin en ruta de jefe `403`.
- **Correo.** Se envía en segundo plano; si falla, el negocio ya está creado. Estados de entrega: `sending`, `accepted`
  (el proveedor aceptó el mensaje) y `failed` (con `not-configured`, `rejected`, `timeout`, `connection` o `unknown`).
  **No existe "entregado"**: `deliveryConfirmed` es siempre `false`, porque que un proveedor acepte un mensaje no prueba que
  la persona lo recibió. El reenvío (`/invitation/resend`) respeta 60 s entre envíos y el tope por hora.
- **Enlace del correo.** `<PUBLIC_APP_URL>/business/access?business=<id>`; el código nunca va en la URL.

Datos: `access_challenges` (índices por negocio/correo/estado y expiración a 24 h) y `access_rate_limits` (TTL por `expiresAt`).

### Configurar y probar el correo

1. Sin configurar nada: todo funciona, pero cada invitación queda `failed: not-configured` (se ve en la ficha).
2. **Prueba local** con Mailpit, un servidor de correo de desarrollo que ya viene en `infra/docker-compose.yml` (`npm run db:up` lo
   levanta junto con MongoDB). En el `.env` del backend: `MAIL_SMTP_HOST=127.0.0.1`, `MAIL_SMTP_PORT=1025`,
   `MAIL_SMTP_REQUIRE_TLS=false` y `MAIL_FROM="Necto (local) <no-reply@necto.local>"`; reinicia el backend. Los mensajes se ven en
   `http://127.0.0.1:8025`. Que Mailpit los acepte solo prueba que *nuestro* envío funciona, no que un correo llegue a un buzón real.
3. **Envío real** (pendiente): hacen falta un proveedor SMTP con sus credenciales (`MAIL_SMTP_*`), un remitente `MAIL_FROM`
   de un dominio verificado (SPF/DKIM) y un buzón de prueba donde confirmar la recepción. Hasta confirmar la recepción en
   un buzón real, no debe afirmarse que el correo "llegó".

## Estructura

```
src/
├── main.ts                      Arranque: validación global de cuerpos y CORS
├── app.module.ts                Registra la plataforma y los módulos de negocio (una línea por módulo)
├── platform/                    Infraestructura transversal, sin reglas de negocio
│   ├── config/                  Lee y valida el entorno (.env) al arrancar
│   ├── database/                La única conexión a MongoDB
│   ├── security/                Tokens, autenticación, autorización por rol y límite de peticiones
│   ├── errors/                  Errores de dominio -> respuestas HTTP (y errores de campo)
│   ├── events/                  Bus de eventos en memoria entre módulos
│   ├── mail/                    Transporte de correo (SMTP con nodemailer, o "no configurado")
│   ├── time/                    Reloj inyectable (pruebas con tiempo fijo)
│   ├── text/                    Normalización compartida (correos, textos opcionales)
│   └── observability/           GET /health
└── modules/                     Un módulo por capacidad de negocio
    ├── auth/
    │   ├── public.ts            Puerta pública
    │   ├── auth.module.ts
    │   ├── api/                 Controlador y DTOs (validación de la entrada)
    │   ├── application/         Casos de uso: registro, login y perfil
    │   ├── domain/              SuperAdmin, reglas de unicidad, errores y el puerto del repositorio
    │   └── infrastructure/      Esquema de Mongo y repositorio de `super_admins`
    ├── onboarding/
    │   ├── public.ts            Puerta pública
    │   ├── onboarding.module.ts
    │   ├── api/                 Controlador y DTOs
    │   ├── application/         Casos de uso: teléfono (paso 1), orígenes (paso 2) y lectura
    │   ├── domain/              Perfil, orígenes permitidos, errores y el puerto del repositorio
    │   └── infrastructure/      Esquema de Mongo y repositorio de `onboarding_profiles`
    ├── businesses/              Negocios, jefe vigente y módulos habilitados (colección `businesses`)
    └── business-access/         Invitación y acceso del jefe por código OTP (`access_challenges`, `access_rate_limits`)
```

Dentro de un módulo, las capas dependen en una sola dirección: `api` y `infrastructure` -> `application` y `domain`;
`application` -> `domain`; el `domain` no conoce a nadie (solo usa `platform/errors`). El `application` nunca toca Mongoose:
habla con un repositorio abstracto (`domain/*.repository.ts`) que implementa `infrastructure/`.

## Módulos

| Módulo | Responsabilidad | Datos de los que es dueño | Rutas |
|--------|-----------------|---------------------------|-------|
| `auth` | Registro y login del superadmin; emite la sesión | Colección `super_admins` | `/auth/super/*` |
| `onboarding` | Teléfono (único entre usuarios) y dónde conoció Necto el usuario | Colección `onboarding_profiles` | `/onboarding/profile/*` |
| `businesses` | Negocios, jefe vigente, catálogo y habilitación de módulos | Colección `businesses` | `/businesses/*` |
| `business-access` | Invitación por correo y acceso del jefe con código OTP | `access_challenges`, `access_rate_limits` | `/business-access/*`, `/businesses/:id/invitation*` |

- **Puertas públicas.** `modules/<módulo>/public.ts` es lo único que otro código puede importar de un módulo. Hoy exporta
  el módulo de Nest (para que `app.module.ts` lo registre) y, si otro módulo lo necesita, contratos: `businesses` exporta
  `BusinessDirectory`, `BusinessModuleAccess` y el evento `BossAssigned`. Nunca se exporta un repositorio, un esquema ni un controlador.
- **Dependencias permitidas.** Un módulo puede depender de `platform/` y, a través de `public.ts`, de otros módulos. Hoy
  `auth` y `onboarding` solo dependen de `platform/`, y `business-access` depende de `businesses` (nunca al revés: `businesses`
  publica `BossAssigned` en el bus de eventos y `business-access` lo escucha). `platform/` no depende de ningún módulo.
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
- **Seguridad:** emisión y verificación de tokens (incluido el de jefe), `AuthenticationGuard` y `SuperAdminGuard`.
- **`businesses`:** creación, idempotencia, validación del catálogo, edición, reemplazo del jefe, pausa y CSV.
- **`business-access`:** códigos (un solo uso, vencimiento, intentos, límites, carrera de dos verificaciones), invitación y
  reenvío, estados de entrega del correo (sin afirmar entrega), sesión del jefe y `BusinessBossGuard`.
- **Arquitectura** (`src/architecture.spec.ts`): lee los imports reales y comprueba que `platform/` no depende de los
  módulos, que los módulos solo se alcanzan por `public.ts`, que las capas respetan su sentido, que Mongoose solo está en
  `infrastructure`, que `@nestjs/jwt` solo está en `platform/security` y `nodemailer` solo en `platform/mail`, y que no hay ciclos entre archivos ni entre módulos.
  Incluye pruebas con violaciones inventadas para asegurar que las reglas de verdad detectan lo que dicen detectar.

La persistencia real (índices únicos, idempotencia, carreras) se verifica contra MongoDB levantando el backend: no hay
pruebas automáticas de integración con base de datos. Para el correo, la verificación local usa un servidor SMTP de pruebas
(ver "Configurar y probar el correo"); no sustituye una prueba de recepción real.

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
