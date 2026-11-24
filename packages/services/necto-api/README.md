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
| `npm run test:api` | Pruebas: servicios de los módulos, DTOs, seguridad, reglas de arquitectura y el script de migración del teléfono. |

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
| `POST` | `/auth/super/register` | Inicia el registro de un superadmin: guarda los datos como pendientes y envía un código de 6 dígitos al correo (`202`). |
| `POST` | `/auth/super/register/verify` | Confirma el código: crea la cuenta y devuelve `{ accessToken, superAdmin }`. |
| `POST` | `/auth/super/register/resend` | Envía un código nuevo para un registro pendiente. |
| `POST` | `/auth/super/login` | Inicia sesión con username o email. Devuelve un JWT. |
| `GET` | `/auth/super/me` | Perfil del superadmin autenticado (requiere `Authorization: Bearer <token>`). |
| `GET` | `/onboarding/profile/me` | Perfil de bienvenida de quien tiene el token (requiere token). |
| `PUT` | `/onboarding/profile/phone` | Onboarding, paso 1: guarda el teléfono (requiere token). |
| `PUT` | `/onboarding/profile/sources` | Onboarding, paso 2 (opcional): guarda dónde nos conoció u «Omitir» (requiere token). |
| `PUT` | `/onboarding/profile/intro-seen` | Marca que la cuenta ya vio la intro de bienvenida (requiere token). |
| `GET` | `/businesses/catalog` | Catálogo de módulos y categorías (superadmin). |
| `GET` / `POST` | `/businesses` | Lista los negocios del superadmin / crea uno con su jefe y módulos (requiere cabecera `Idempotency-Key`). |
| `GET` / `PUT` | `/businesses/:id` | Ficha / edición (perfil, módulos y jefe) conservando el id. |
| `POST` | `/businesses/:id/pause` y `/resume` | Pausa o reanuda el negocio. |
| `GET` | `/businesses/export.csv` | Exporta los negocios del superadmin (neutraliza fórmulas). |
| `GET` | `/businesses/:businessId/invitation` | Estado de la invitación al jefe. |
| `POST` | `/businesses/:businessId/invitation/resend` | Envía un código nuevo al jefe vigente. |
| `POST` | `/businesses/:businessId/invitation/temporary-code` | Genera un **código temporal** para copiar y entregar al jefe (no se envía por correo). Solo el dueño. |
| `POST` | `/business-access/otp/request` | Pide un código por correo `{ email }`. `202` si el correo es jefe de un negocio activo; `404 email-not-assigned` si no (primero lo debe invitar el superadmin). |
| `POST` | `/business-access/otp/verify` | Canjea el código `{ email, code, remember? }`: abre la sesión (cookie `HttpOnly`) y devuelve el token y los negocios autorizados. |
| `GET` | `/business-access/session` | ¿Hay una sesión vigente en este navegador? (cookie). |
| `POST` | `/business-access/session/refresh` | Continúa con esa sesión sin otro código: token nuevo y negocios autorizados ahora. |
| `DELETE` | `/business-access/session` | Cierra la sesión y olvida el dispositivo (revoca en el servidor y borra la cookie). |
| `POST` | `/business-access/session/reverify/request` y `/reverify` | Confirma el correo con un código nuevo estando dentro (acciones sensibles). |
| `POST` | `/business-access/session/revoke-others` | "Cerrar las demás sesiones". Exige una verificación reciente. |
| `GET` | `/business-access/businesses` y `/:businessId` | Solo los negocios que la persona administra ahora (token de administrador). |
| `GET` | `/business-access/businesses/:businessId/modules/:moduleId` | ¿Puede abrir ese módulo? `403 module-not-enabled` si el negocio no lo tiene. |
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

### Registro con código por correo

Registro con verificación por correo (el registro **no** crea la cuenta hasta confirmar el código):

| Método | Ruta | Body | Respuesta |
|--------|------|------|-----------|
| `POST` | `/auth/super/register` | `username`, `email`, `password`, `identityDocumentType`, `identityDocument`, `acceptTerms` | `202 { registrationId, email, expiresAt, resendAvailableAt }` y envía el código al correo |
| `POST` | `/auth/super/register/verify` | `registrationId`, `code` (6 dígitos) | `200 { accessToken, superAdmin }` (igual que login): crea la cuenta |
| `POST` | `/auth/super/register/resend` | `registrationId` | `202` con la misma forma que `register`: código nuevo, intentos a cero |

Errores con `code` estable (cuerpo `{ message, error, statusCode, code }`):

| Status | `code` | Cuándo |
|--------|--------|--------|
| `400` | `invalid-code` | Código incorrecto; suma un intento. |
| `400` | `code-expired` | Código vencido, o el registro pendiente ya no existe (id desconocido o ya usado): hay que registrarse de nuevo. |
| `429` | `too-many-attempts` | Se agotaron los intentos de ese código (`OTP_MAX_ATTEMPTS`, 5); sirve pedir uno nuevo con `resend`. |
| `429` | `resend-too-soon` | `resend` antes de `resendAvailableAt` (cabecera `Retry-After`). |
| `429` | `too-many-codes` | Ya se enviaron 5 códigos a ese correo en los últimos 30 min, contando `register` y `resend` (registrarse de nuevo no reinicia la cuenta). Cabecera `Retry-After`. |
| `409` | — | Usuario, correo o documento ya registrados (en `register` y, si alguien los tomó entre medias, en `verify`). Mismo mensaje que antes: `A super admin with that <campo> already exists`. |

- El registro pendiente vive en la colección `pending_registrations` (TTL sobre `purgeAt`: lo que dure más entre el código y la ventana de envíos, para que el límite por correo sobreviva a un código vencido). Cada verificación reserva su intento en la base antes de comparar (atómico), así que las peticiones en paralelo no pasan del máximo. Guarda el hash bcrypt de la contraseña y el **HMAC** del código (ligado al id del pendiente, el correo y el propósito `super-admin-registration`); el código nunca se guarda ni se registra en claro.
- Un nuevo `register` con el mismo correo o usuario reemplaza al pendiente anterior.
- Usa la misma configuración que los códigos de acceso: `OTP_SECRET`, `OTP_TTL_MINUTES` (10), `OTP_MAX_ATTEMPTS` (5), `OTP_RESEND_COOLDOWN_SECONDS` (60) y `PUBLIC_APP_URL` (el correo enlaza a `/super/register`). Sin SMTP configurado el correo falla (se registra en el log solo con el id) y el código no llega.
- Límite por IP: `register` y `resend` 5/min, `verify` 10/min.

### Límite de intentos

`register`, `register/resend` y `login` aceptan 5 peticiones por minuto por IP y `register/verify` 10; después responden `429`.
`PUT /onboarding/profile/phone` acepta 10 por minuto por IP. El resto de rutas, 100 por minuto.

## Módulo onboarding

Guarda lo que el SuperAdmin cuenta justo después de su primer inicio de sesión: su **teléfono** y **dónde conoció
Necto**. El frontend que lo consume es el módulo
[`onboarding`](../../apps/web/modules/app/src/modules/onboarding/README.md).

Todas sus rutas exigen `Authorization: Bearer <token>` con el token de superadmin que emite `POST /auth/super/login`
(se verifica en el mismo proceso con los guards de `platform/security`, sin llamadas entre módulos). El id del usuario sale siempre
del token (`sub`); nunca se manda en el cuerpo ni en la URL, así nadie puede leer o escribir el perfil de otra cuenta.

Las cuatro rutas responden con la misma forma:

```json
{ "phone": "+573001234567", "sources": ["other"], "sourceOther": "Un amigo", "completed": true, "introSeen": true }
```

- `GET /onboarding/profile/me` sin perfil guardado responde `200` con
  `{ "phone": null, "sources": [], "sourceOther": null, "completed": false, "introSeen": false }` (no es un error).
- `completed` pasa a `true` cuando se guarda el paso 2, también si la persona eligió **Omitir** (lista vacía). Antes es
  `false`. El cliente nunca debe deducir el avance de `sources.length`: con teléfono y `completed: false` toca el paso 2.
- `sourceOther` es el texto libre de «Otro»; `null` con cualquier otra elección.
- `introSeen` es `true` si `completed`, si ya hay perfil (quien guardó un teléfono ya pasó la bienvenida) o si la
  cuenta marcó la intro como vista, en cualquier dispositivo. Así la intro solo la ven los usuarios nuevos, una vez.

### Intro vista

`PUT /onboarding/profile/intro-seen` (sin cuerpo)

- El frontend lo llama **al terminar el primer acto** de la intro de `/welcome` (no al empezarla), o al pulsar
  «Empezar» en el póster de movimiento reducido. Responde el perfil, ya con `introSeen: true`.
- Es idempotente: llamarlo de nuevo no cambia nada y se conserva la primera fecha.

### Teléfono

`PUT /onboarding/profile/phone`

```json
{ "phone": "+57 300 123 4567" }
```

- Debe ser un **móvil válido de su país, con indicativo** (`+57…`). Se aceptan espacios, guiones, puntos y paréntesis;
  sin `+` no se adivina el país y se rechaza.
- Se **normaliza a E.164** (`+573001234567`) antes de validar y de guardar, con
  [`libphonenumber-js/mobile`](https://www.npmjs.com/package/libphonenumber-js) (metadatos de móviles: los fijos no
  pasan). La regla vive en una sola función, `domain/phone-number.ts`, que usan el DTO, el servicio y el script de
  migración; el frontend aplica la misma librería.
- **No se puede repetir entre usuarios.** Como se compara la forma canónica, `+57 300 123 4567` y `+573001234567` son el
  mismo número. Si otra cuenta ya lo usa responde `409` con `code: "phone-in-use"`. Un usuario sí puede volver a
  guardar su propio número o cambiarlo.
- Un índice único en MongoDB lo garantiza aunque dos peticiones lleguen al mismo tiempo (una gana, la otra recibe `409`).
- Límite de **10 peticiones por minuto por IP**: un `409` revela si un número está en uso, por eso no se deja sondear.
- Número inválido o campos de más: `400` (con `fields.phone`).

### Dónde nos conoció

`PUT /onboarding/profile/sources`

```json
{ "sources": ["other"], "sourceOther": "Un amigo del gimnasio" }
```

- Valores permitidos: `instagram`, `tiktok`, `facebook`, `youtube`, `whatsapp`, `linkedin`, `family`, `business`, `other`.
- **Elección única y opcional**: una opción como máximo, o la lista vacía `[]` para **Omitir**. Las dos completan el
  perfil. Dos opciones, valores fuera de la lista o campos de más: `400`.
- `sourceOther` (opcional, hasta 80 caracteres, se recortan los espacios): el texto libre de «Otro». Solo se guarda con
  `["other"]`; con otra elección se descarta, así una respuesta vieja no sobrevive a un cambio de opinión.
- Requiere haber guardado antes el teléfono; si no, responde `409` con `code: "phone-required"` (el frontend vuelve al
  paso 1).
- Volver a llamarlo reemplaza la respuesta y conserva la fecha en que se completó. Los perfiles guardados antes de la
  elección única pueden conservar varias opciones hasta que se vuelvan a guardar.

### Errores comunes del onboarding

Los `409` llevan un `code` estable para que el cliente distinga el caso sin leer el mensaje:

| HTTP | `code` | Cuándo |
|------|--------|--------|
| `400` | | Cuerpo inválido (`fields` dice qué campo). |
| `401` | | Sin token, token inválido o vencido. |
| `403` | | Token válido de un usuario cuyo rol no es `superadmin`. |
| `409` | `phone-in-use` | El teléfono ya es de otra cuenta. |
| `409` | `phone-required` | Paso 2 sin haber guardado el teléfono. |
| `429` | | Demasiadas peticiones. |

```json
{ "message": "Phone number already in use", "error": "Conflict", "statusCode": 409, "code": "phone-in-use" }
```

### Datos

Colección `onboarding_profiles` (un documento por usuario), en la misma base `super_admin_auth`:

| Campo | Descripción |
|-------|-------------|
| `userId` | Id del superadmin (el `sub` del token). **Único.** |
| `phone` | Móvil en E.164 canónico. **Único.** |
| `sources` | Orígenes: vacío hasta el paso 2 y también si la persona eligió Omitir. Como máximo uno desde la elección única. |
| `sourceOther` | Texto libre de «Otro» o `null`. Los documentos anteriores a este campo no lo tienen (se lee como `null`). |
| `completedAt` | Fecha en que terminó los dos pasos (la del reloj del servidor, `Clock`); `null` mientras tanto. |
| `createdAt`, `updatedAt` | Marcas de tiempo automáticas. |

Colección `onboarding_intro_views` (un documento por usuario que ya vio la intro). Va aparte porque un perfil siempre
tiene teléfono y la intro se ve antes de darlo:

| Campo | Descripción |
|-------|-------------|
| `userId` | Id del superadmin (el `sub` del token). **Único.** |
| `seenAt` | Cuándo vio la intro por primera vez. No cambia después. |
| `createdAt`, `updatedAt` | Marcas de tiempo automáticas. |

### Migración del teléfono

Los teléfonos guardados antes de la normalización pueden estar escritos de otra forma. El script
`scripts/normalize-onboarding-phones.ts` los reescribe en E.164 canónico con la misma función que usa el API:

```bash
cd packages/services/necto-api
npm run migrate:phones              # en seco: informa y no escribe nada
npm run migrate:phones -- --apply   # escribe los cambios
```

- Lee `MONGODB_URI` del entorno o de `.env`. Es **idempotente**: lo que ya está en forma canónica no se toca.
- Se corre **después del despliegue** y **una segunda vez más tarde**, para recoger lo que escribió el API viejo entretanto.
- **Nunca fusiona cuentas.** Si dos perfiles quedarían con el mismo número (o MongoDB rechaza la escritura con el error
  `11000`), no reescribe ninguno y lo informa como colisión; una persona decide qué cuenta conserva el número.
- Los números que no son un móvil válido con indicativo se informan y se dejan como están.
- En el informe los teléfonos salen enmascarados (`+57*******567`). Termina con código `2` si hay colisiones o números
  ilegibles, `1` si falla y `0` si no queda nada pendiente.
- Vive fuera de `src/` porque es una herramienta de operación, no parte del API; su lógica pura tiene pruebas en
  `scripts/normalize-onboarding-phones.spec.ts`, que corren con `npm run test:api`.

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
- **Pausar / reanudar.** Un negocio pausado deja de aparecer para su administrador y bloquea sus módulos (no recibe códigos de acceso).
- **Ficha.** Resumen, módulos y equipo; `summary.hasActivity` es `false` (no se inventan métricas). Nunca expone códigos,
  hashes ni secretos.
- **Puerta pública** (`public.ts`): `BusinessDirectory` (consulta de un negocio y su jefe vigente), el evento `BossAssigned`
  y `BusinessModuleAccess` (para que un módulo futuro compruebe en el servidor si un módulo está habilitado), más `AdministeredBusinessProfiles` (lo que el administrador puede leer y corregir de su negocio: contacto y categoría; nunca módulos, jefe, estado, moneda ni zona horaria), los DTOs `BusinessContactDto` y `BusinessCategoryDto` (la misma validación en el formulario del dueño y en el del administrador) y el catálogo.

Datos: colección `businesses`, índices `{ ownerId, idempotencyKey }` (único), `{ ownerId, createdAt }` y
`{ ownerId, status, category }`.

## Módulo business-access

Acceso de los **administradores de negocio** (el jefe asignado de cada negocio) y de los **operadores** de un módulo (`turnos` y `pedidos`),
**sin contraseña**: el correo asignado y un código de 6 dígitos enviado a ese correo. **Es el mismo login para los dos roles**: la
identidad es el correo, y una misma persona puede administrar varios negocios y ser operadora de otros; entra una vez y elige.

### Cómo funciona

1. `POST /business-access/otp/request { email }` → `202` (`expiresInMinutes`, `resendAfterSeconds`, `maxAttempts`) si el correo tiene
   **algún acceso ahora mismo**: es el jefe vigente de un negocio **activo**, o es operador de un negocio activo que tiene ese módulo
   habilitado. Se pide el envío del código. Si no (sin negocio, negocio pausado, jefe reemplazado, módulo deshabilitado u operador
   retirado), responde `404` con `code: "email-not-assigned"` y **no se crea ningún código**: la pantalla no avanza y dice que primero
   el superadministrador o un administrador debe asignar a la persona. Pedir otro código antes de 60 s, o mientras espera un código temporal, responde `202` sin
   emitir uno nuevo.
   > **Decisión de producto:** esta respuesta revela si un correo está asignado a un negocio (antes el acceso respondía igual para
   > todos). Cada solicitud, asignada o no, cuenta para los límites por correo y por IP (5/h y 20/h), que es lo que frena el sondeo
   > masivo. Si algún día debe volver la respuesta genérica, el único cambio es dejar de lanzar `EmailNotAssignedError` en
   > `AdminLoginService.requestCode`.
2. `POST /business-access/otp/verify { email, code, remember? }` → `200`. El servidor gasta el código, comprueba que el correo tenga al
   menos un acceso y abre una **sesión de servidor**. Responde con `accessToken` (corto), `expiresInSeconds`,
   `admin { email, remember }`, `accesses[]` (todo lo que la persona puede abrir, en cualquier rol) y `businesses[]` (solo los que
   **administra**, por compatibilidad con las pantallas anteriores a los roles), y pone la cookie de sesión.
   Cada elemento de `accesses`: `{ key, businessId, businessName, category, categoryOther, role: "admin" | "operator", modules, personName, views, firstView, operable }`
   (`views` y `firstView` solo para un operador: las vistas de su módulo que puede usar, en orden, y la primera, donde debe aterrizar; `operable: false` mientras es un operador `pending` que aún no inició sesión), donde `key` es `<businessId>:admin` para administradores y `<businessId>:operator:<moduleId>` para operadores (un correo puede operar distintos módulos del mismo negocio y aparecen como accesos independientes).
   Para un administrador, `modules` son los módulos habilitados del negocio; para un operador, **solo** el módulo al que está asignado.
3. Con un solo acceso el cliente entra directo; con varios muestra el selector de **negocio y rol** (un correo puede ser jefe y operador
   del mismo negocio: son dos elementos). Un administrador entra a su dashboard (`GET /dashboard/businesses/:businessId`, que dice si va al `dashboard` o debe continuar la configuración); un operador va **directo a la primera vista permitida de su módulo** (`firstView`), sin pasar por el dashboard general
   (`GET /turnos/businesses/:businessId/operator` o `GET /pedidos/businesses/:businessId/operator`). `GET /business-access/accesses` devuelve la misma lista con la sesión abierta.

**Conocer el correo nunca basta**: sin un código válido no se crea ninguna sesión, y `GET /session` sin la cookie responde `401`.

### Códigos (OTP)

- Seis dígitos con `crypto.randomInt`, vigencia de **10 minutos**, **un solo uso** (el gasto es atómico: si llegan dos verificaciones
  simultáneas, solo una gana), **máximo 5 intentos por código** y **60 s** entre códigos del mismo correo.
- Solo se guarda su **HMAC-SHA256** (clave `OTP_SECRET`) atado al código, al correo y al propósito, comparado en tiempo constante. El
  código no aparece en respuestas ni en registros.
- Un código pertenece a un **correo**, no a un negocio. Cuáles negocios abre se decide **al usarlo**, con las asignaciones vigentes en ese
  momento. La invitación enviada al asignar un jefe es un código de acceso más (y además registra el estado de entrega del negocio).
- Propósitos: `invitation`, `login` y `reverify`. Los de acceso (`invitation`/`login`) no sirven para reverificar y al revés. Pedir un
  código nuevo invalida el anterior de su familia.
- La **verificación** sigue sin filtrar información: código errado, vencido, usado, bloqueado o de un correo sin negocio dan todos
  `401 Invalid or expired code`. Las otras respuestas visibles son `429` con `Retry-After` y, al **pedir** el código, `404 email-not-assigned`.
- **Límites** (MongoDB, ventana fija; cada solicitud cuenta aunque se rechace): por correo y por IP, para intentos (10 y 30 por 15 min) y
  para envíos (5 y 20 por hora). Pedir códigos nuevos no reinicia los intentos. Además, `@Throttle` por ruta.

### Código temporal del superadmin (provisional)

Mientras el envío real de correo no esté listo, el **dueño** del negocio puede generar un código para el jefe y entregárselo por otro medio:
`POST /businesses/:businessId/invitation/temporary-code` → `201 { code, bossEmail, expiresAt }` con `Cache-Control: no-store`.

- Es un código de acceso normal del correo del jefe (propósito `manual`): 10 minutos, un solo uso, 5 intentos. **No se envía por correo**
  (su entrega queda `not-sent`). Es la **única** respuesta que contiene un código: se muestra una vez y en la base solo queda su HMAC.
- Solo el dueño del negocio, con el negocio activo, y como máximo 5 por hora y negocio (los de `OTP_CONTEXT_SEND_LIMIT`). Cada uno
  reemplaza al anterior y guarda `issuedBy` (quién lo generó).
- Mientras el código temporal espera, si el jefe pide un código en la pantalla de acceso **no se emite otro** (no pisaría el que le
  entregaron). Deja de servir al usarse, al vencer o si el jefe del negocio es reemplazado.
- **Riesgo asumido:** quien tenga el código entra como el jefe. Es una puerta del superadmin hacia la sesión del jefe; por eso es
  provisional y debe retirarse (o limitarse) cuando el correo real funcione.

### Sesiones, "recordar dispositivo" y regreso rápido

- La sesión vive en el **servidor** (`admin_sessions`). El navegador guarda un secreto aleatorio en la cookie `necto_admin_session`
  (**`HttpOnly`**, **`SameSite=Strict`**, `Secure` si `PUBLIC_APP_URL` es https); la base guarda solo su **hash SHA-256**.
- El `accessToken` (JWT, `role: business-admin`, solo lleva el id de la sesión; el nombre es histórico: **identifica una sesión por correo, no
  dice qué puede hacer la persona**, eso se decide en cada petición) dura **10 minutos** y se pide de nuevo con
  `POST /session/refresh` usando la cookie. El cliente lo guarda **solo en memoria**.
- **Sesión normal:** cookie de navegador (muere al cerrarlo), 2 h de inactividad y 12 h en total.
- **"Recordar este dispositivo"** (`remember: true`, **desactivado por defecto**): cookie de 30 días como máximo, 14 días de inactividad,
  nunca más de **30 días desde el código** aunque se renueve (`ADMIN_REMEMBER_DAYS` no puede pasar de 30).
- **Renovación:** `refresh` mueve la caducidad por inactividad, nunca más allá de la absoluta, y devuelve los accesos autorizados en ese
  instante. Si la persona ya no tiene **ninguno** (ni como administrador ni como operador), la sesión se termina; si le queda alguno, la
  sesión sigue y solo desaparece lo retirado.
- **Revocación:** `DELETE /session` (cerrar sesión u olvidar el dispositivo) y "cerrar las demás sesiones" terminan la sesión **al
  instante**: el guard comprueba la sesión en la base en **cada** petición, así que ni un token que aún no venció sirve.
  Abrir una sesión nueva en un navegador termina la anterior de ese navegador.
- **Acciones sensibles:** `@RecentlyVerified()` exige que el último código confirmado tenga menos de 10 minutos
  (`ADMIN_SENSITIVE_REVERIFY_MINUTES`); si no, `403` con `code: "reverification-required"`. El cliente pide un código con
  `POST /session/reverify/request`, lo confirma con `POST /session/reverify { code }` y reintenta. Hoy la usa `revoke-others`.

### Permisos

- Roles separados: un token de superadmin en una ruta de administrador (y al revés) da `403`.
- En cada petición se comprueba: sesión vigente y del mismo correo, y, por negocio, que el correo sea el **jefe vigente**, que el negocio
  esté **activo** y, por módulo, que lo tenga **habilitado**. Pausar un negocio, reemplazar al jefe o quitar un módulo cierran la
  puerta al instante. Un negocio desconocido, pausado o ajeno responde igual (`404`).
- Para que un módulo funcional (reservas, turnos...) proteja sus rutas `/…/:businessId/…`, importa `BusinessAccessModule` y usa los
  decoradores de `business-access/public.ts`: `@BusinessAdminOnly()` (solo comprueba la **sesión**), `@RecentlyVerified()`,
  `@RequiresBusinessModule('reservas')` (ser el jefe de ESE negocio y que tenga el módulo), `@AdministersBusiness()` (para lo que tiene todo
  negocio, sin exigir ningún módulo: es el que usa `business-setup`) y `@OperatesModule('turnos')` (ser **operador** de ESE negocio para ese módulo).
- **Dos roles, dos puertas.** `@RequiresBusinessModule` exige ser el jefe; `@OperatesModule` exige una asignación de operador. Ninguna
  sirve para la otra: ser jefe no convierte en operador y un operador nunca entra a una ruta de administrador (todas responden el mismo `404`).
- **Quién asigna operadores.** `business-access` **no guarda ni copia** las asignaciones: cada módulo que asigna personas implementa
  `MemberAccessSource` y se registra al arrancar en `MemberAccessRegistry` (así `business-access` no importa a los módulos y no hay
  ciclos). En cada decisión se pregunta al módulo dueño, y `business-access` solo acepta la asignación si el negocio está **activo** y el
  módulo sigue **habilitado**: retirar al operador, deshabilitar el módulo o pausar el negocio cierran el acceso en la petición siguiente.
  Retirar una asignación **no borra la identidad** (que es solo el correo) ni los demás accesos de esa persona.

### Correo

Se envía en segundo plano; si falla, lo demás ya está hecho. Estados: `sending`, `accepted` (el proveedor aceptó el mensaje) y `failed`
(`not-configured`, `rejected`, `timeout`, `connection` o `unknown`). **No existe "entregado"**: que un proveedor acepte un mensaje no
prueba que la persona lo recibió (`deliveryConfirmed` es siempre `false`). El enlace del correo es `<PUBLIC_APP_URL>/business/access`
y nunca lleva el código.

Datos: `access_challenges`, `access_rate_limits` y `admin_sessions` (con índices TTL solo de limpieza: nada depende de ellos para
decidir si algo es válido). `businesses` suma el índice `{ boss.email, status }`.

### Variables de este módulo

| Variable | Defecto | Descripción |
|----------|---------|-------------|
| `OTP_SECRET` | (obligatoria) | Clave del HMAC de los códigos; ≥32 caracteres y distinta de `JWT_SECRET`. |
| `OTP_*` | ver `.env.example` | Vigencia, intentos y límites de los códigos. |
| `ADMIN_ACCESS_TOKEN_MINUTES` | 10 | Vida del token corto. |
| `ADMIN_SESSION_IDLE_MINUTES` / `ADMIN_SESSION_HOURS` | 120 / 12 | Sesión normal: inactividad y total. |
| `ADMIN_REMEMBER_DAYS` / `ADMIN_REMEMBER_IDLE_DAYS` | 30 / 14 | Dispositivo recordado (nunca más de 30 días en total). |
| `ADMIN_SENSITIVE_REVERIFY_MINUTES` | 10 | Antigüedad máxima del último código para una acción sensible. |
| `PUBLIC_APP_URL` | `http://localhost:6020` | Dirección del frontend (enlace del correo; `https://` activa `Secure` en la cookie). |
| `CORS_ORIGIN` | `http://localhost:6020` | Origen del frontend; el backend permite credenciales (cookies). |

### Configurar y probar el correo

1. Sin configurar nada: todo funciona, pero cada invitación queda `failed: not-configured` (se ve en la ficha).
2. **Prueba local** con Mailpit, un servidor de correo de desarrollo que ya viene en `infra/docker-compose.yml` (`npm run db:up` lo
   levanta junto con MongoDB). En el `.env` del backend: `MAIL_SMTP_HOST=127.0.0.1`, `MAIL_SMTP_PORT=1025`,
   `MAIL_SMTP_REQUIRE_TLS=false` y `MAIL_FROM="Necto (local) <no-reply@necto.local>"`; reinicia el backend. Los mensajes se ven en
   `http://127.0.0.1:8025`. Que Mailpit los acepte solo prueba que *nuestro* envío funciona, no que un correo llegue a un buzón real.
3. **Envío real** (pendiente): hacen falta un proveedor SMTP con sus credenciales (`MAIL_SMTP_*`), un remitente `MAIL_FROM`
   de un dominio verificado (SPF/DKIM) y un buzón de prueba donde confirmar la recepción. Hasta confirmar la recepción en
   un buzón real, no debe afirmarse que el correo "llegó".

## Módulo business-setup
Configuración inicial (base) de un negocio, hecha por **su administrador** (el jefe asignado que entra con OTP). Referencia visual:
`referencias html/necto-negocios-configuracion.html`. Cubre los cuatro pasos de la base: módulos asignados, datos del negocio, horarios,
tipo de negocio y la revisión. **No** incluye los ajustes propios de cada módulo (filas, operadores, profesionales, reglas...): siguen
`pending`.

- **Autorización.** Todas las rutas cuelgan de `/business-setup/businesses/:businessId` y llevan `@AdministersBusiness()`
  (`business-access`): token de administrador, sesión de servidor vigente y, **en cada petición**, que esa persona sea hoy el jefe
  vigente de ese negocio **activo**. El administrador sale de la sesión, nunca del cuerpo ni de la URL. Sin token `401`; token de
  superadmin `403`; negocio ajeno, inexistente, pausado, id mal formado o jefe reemplazado, **el mismo `404`**. Un módulo no asignado
  responde `403` con `code: "module-not-enabled"`.
- **Un solo negocio como fuente.** Nombre, razón social, NIT, teléfono, correo, dirección, sitio web, categoría, moneda, zona
  horaria y módulos se **leen y escriben en el documento del negocio** (colección `businesses`) a través del contrato público
  `AdministeredBusinessProfiles`; no hay copia. Lo que escribe el administrador lo ve el superadministrador en la ficha. La escritura
  comprueba en la misma operación que sigue siendo el jefe del negocio activo, y sube su `version` (si el dueño estaba editando una
  copia vieja, recibe `409` en vez de pisar el cambio). El administrador **no puede** cambiar módulos, jefe, estado, moneda ni zona
  horaria: no existe esa ruta y los cuerpos que traen esos campos se rechazan con `400`. Solo el superadministrador asigna módulos
  (`POST`/`PUT /businesses`, `@SuperAdminOnly()`).
- **Lo que guarda este módulo** (colección `business_setups`, un documento por negocio, índice único `businessId`): descripción, logo,
  horario base, horarios propios de módulos y progreso. Se crea con la primera escritura; leer no crea nada.
- Todas las respuestas llevan `Cache-Control: no-store`. Las escrituras devuelven el **estado completo** (el mismo de `GET`), así
  la pantalla se repinta con lo que el servidor guardó.

### Estado completo: `GET /business-setup/businesses/:businessId`
```json
{
  "business": { "id": "…", "status": "active", "currency": "COP", "timezone": "America/Bogota" },
  "modules": [
    { "id": "reservas", "name": "Reservas", "description": "…", "schedule": { "mode": "inherited" }, "settings": { "status": "pending" } },
    { "id": "turnos", "name": "Turnos", "description": "…", "schedule": { "mode": "inherited" }, "settings": { "status": "ready", "summary": { "queueCount": 2, "operatorCount": 3 } } }
  ],
  "profile": { "name": "…", "legalName": null, "taxId": null, "phone": null, "supportEmail": null, "address": null, "website": null, "description": null },
  "category": { "id": "gastronomy", "other": null },
  "turnos": { "profile": "restaurant", "suggested": "restaurant", "profiles": [{ "id": "clinic", "name": "Clínica / Salud", "description": "…", "suggestedQueues": ["Consulta general", "Laboratorio"] }] },
  "logo": null,
  "schedule": {
    "timezone": "America/Bogota",
    "base": { "days": { "mon": { "open": true, "ranges": [{ "start": "08:00", "end": "18:00" }] }, "tue": {}, "…": "los 7 días" }, "saved": false, "openNow": true },
    "modules": { "reservas": { "inherit": true, "days": {}, "ownDays": null, "openNow": true } }
  },
  "progress": { "currentStep": null, "visitedSteps": [], "baseReady": false, "baseReadyAt": null }
}
```
- `modules`: **solo** los módulos habilitados para el negocio, en el orden del catálogo (`reservas`, `turnos`, `agendamiento`, `referidos`,
  `inventario`, `pedidos`). Puede ser `[]`. `schedule.mode` es `inherited` o `custom`; `settings.status` es `pending` hasta que el módulo informe que su configuración está preparada: hoy Turnos (`ready`, con `settings.summary { queueCount, operatorCount }`) y Pedidos (`ready`, con `settings.summary { modalityCount, operatorCount }`, registrado por IoC en `ModuleSetupStatusRegistry`) lo reportan desde el servidor.
- `turnos`: `null` si el negocio no tiene Turnos. Si lo tiene, `profile` es el perfil de atención vigente (el elegido o, si nadie eligió, el que sugiere la categoría), `suggested` el que sugiere la categoría y `profiles[]` las cinco opciones con los nombres de las filas que sugiere cada una.
- `profile` y `category` son los datos del negocio tal como están ahora (precarga del formulario). `description` es de este módulo.
- `logo`: `null` o `{ contentType, sizeBytes, updatedAt, url }`. **Los bytes nunca vienen en el JSON**: se piden a `url` (ver Logo).
- `schedule.base.saved` es `false` mientras nadie guardó un horario: `days` muestra entonces el horario por defecto (lunes a viernes
  08:00-18:00, sábado 09:00-13:00, domingo cerrado). `schedule.modules.<id>.days` es el horario **efectivo** (el del negocio si hereda,
  el propio si no) y `ownDays` el propio guardado (se conserva aunque el módulo herede). `openNow` evalúa el instante actual en la zona
  horaria del negocio (`null` si la zona no sirve).
- `progress.currentStep` es uno de `data`, `schedule`, `category`, `review` (o `null`); `visitedSteps` no repite. `baseReady` indica que
  la base se guardó como preparada y nadie la modificó después.

### Rutas
| Método | Ruta (tras `/business-setup/businesses/:businessId`) | Qué hace |
|--------|------------------------------------------------------|----------|
| `GET` | `` | Estado completo; sirve para retomar donde quedó, también en otra sesión. |
| `GET` | `/modules` | `{ baseReady, modules[] }`: pantalla inicial. |
| `PUT` | `/profile` | Formulario «Datos del negocio». |
| `PUT` | `/category` | «Tipo de negocio». |
| `PUT` | `/logo` · `DELETE /logo` · `GET /logo` | Subir o reemplazar, quitar, descargar el logo. |
| `PUT` | `/schedule` | Horario base del negocio. |
| `PUT` | `/schedule/modules/:moduleId` | Hereda o tiene horario propio un módulo asignado. |
| `PUT` | `/progress` | Recuerda el paso actual. |
| `POST` | `/complete` | «Guardar configuración base». |

**`PUT /profile`** reemplaza el formulario completo: `{ name, legalName?, taxId?, phone?, supportEmail?, address?, website?, description? }`.
`name` es obligatorio (2 a 120); un campo omitido o en blanco se **borra**. Las reglas y normalizaciones son exactamente las del formulario del
superadministrador (`phone` `+573001234567`, `taxId` 4 a 20 caracteres, `website` sin protocolo pasa a `https://…`, correo en minúsculas).
`description` hasta 500 caracteres. La moneda y la zona horaria **no** son editables y se muestran en solo lectura. Cualquier otro campo
(`modules`, `boss`, `currency`, `timezone`, `category`, `status`...) responde `400`.

**`PUT /category`**: `{ category, categoryOther? }` con `category` en `gastronomy`, `retail`, `professional-services`, `health-wellness`, `other`.
Con `other`, `categoryOther` (2 a 60 caracteres) es obligatorio (`400` con `fields.categoryOther`); con otra categoría se descarta. La
precarga es la categoría registrada por el superadministrador.
Para un negocio **con Turnos** el cuerpo acepta además `turnosProfile` (`clinic`, `restaurant`, `bank`, `salon` o `custom`): el **perfil de atención**
que sugiere las primeras filas de Turnos. Ese dato **pertenece a Turnos** (se guarda allí y es el mismo que edita su primer paso), así que
cambiarlo desde aquí nunca borra ni duplica lo ya configurado en Turnos (ver «Cambiar el perfil» en el módulo `turnos`). Sin `turnosProfile` el
perfil queda como estaba. Un perfil desconocido o enviado a un negocio sin Turnos responde `400` con `fields.turnosProfile`, y no cambia nada.

**Logo.** `PUT /logo` es `multipart/form-data` con **un** campo de archivo llamado `logo` (nada más). PNG, JPG o WebP de **hasta 1 MB**
(`1 048 576` bytes; más pesa `413`). El tipo se decide por los **bytes** del archivo (firma PNG/JPEG), no por la extensión ni por el
`Content-Type` que declare el navegador: SVG, GIF, texto o un archivo renombrado dan `400` (`code: "invalid-logo"`, `fields.logo`). Un tipo
declarado que contradice el contenido también da `400`. `GET /logo` devuelve la imagen con su `Content-Type`, `X-Content-Type-Options: nosniff`
y `Cache-Control: no-store`; **necesita el `Authorization`**, así que el front la descarga con `fetch` y la muestra con un `blob:` URL (una
etiqueta `<img src>` directa no envía el token). Sin logo, `404`. `DELETE /logo` es idempotente.

**Horarios.** Cuerpo de `PUT /schedule`: `{ "schedule": { "mon": { "open": true, "ranges": [{ "start": "08:00", "end": "18:00" }] }, "tue": …, "sun": { "open": false, "ranges": [] } } }`
(días `mon tue wed thu fri sat sun`, los siete obligatorios).
- Horas `HH:mm` de 24 h (`00:00` a `23:59`), **hora local del negocio**: el servidor no las convierte a UTC. La zona horaria del negocio
  (`schedule.timezone`, la registrada por el superadministrador) interviene al comparar un instante con ellas (`openNow`).
- Un día abierto tiene de 1 a 6 franjas; cada franja necesita **apertura y cierre**; el cierre es posterior a la apertura del mismo día
  (no hay franjas que crucen la medianoche); las franjas de un día no se solapan (una puede empezar justo cuando termina otra). Un día cerrado
  no guarda franjas. Se guardan ordenadas por apertura.
- Los errores llegan **todos juntos** y con la ruta del campo: `400 { "code": "invalid-schedule", "message": [...], "fields": { "schedule.mon.ranges.1.end": ["…"] } }`.
  Nada se guarda si hay un error.
- **Herencia.** `PUT /schedule/modules/:moduleId` con `{ "inherit": true }` hace que el módulo siga al negocio: cualquier cambio posterior del
  horario base se refleja de inmediato (se calcula al leer, no se copia). Con `{ "inherit": false, "schedule": {…} }` el módulo usa el suyo,
  que **no** cambia cuando cambia el del negocio (es la excepción). Con `{ "inherit": false }` sin `schedule` usa el que ya tenía o, si nunca tuvo, una copia del horario del negocio en ese
  momento. Al volver a `inherit: true` el horario propio se **conserva** (`ownDays`), y reaparece si se vuelve a `inherit: false`. Un módulo
  que el superadministrador retira deja de aparecer y de poder configurarse; si se vuelve a asignar, recupera su excepción.

**`PUT /progress`**: `{ "step": "data" | "schedule" | "category" | "review" }`. Solo recuerda dónde está la persona; no valida el orden ni cambia
`baseReady`. Cada paso guarda lo suyo con su ruta, así que **cerrar sesión no pierde nada**: al volver, `GET` devuelve todo.

**`POST /complete`** («Guardar configuración base»): vuelve a validar lo que tiene la base (nombre, `other` con descripción, horario base y
horarios propios) y marca **solo la base** como preparada (`progress.baseReady: true`, `baseReadyAt`, `currentStep: "review"`). Repetirlo no cambia la
fecha. Si algo no es válido: `409 { "code": "setup-incomplete", "fields": {…} }`. **Cualquier cambio posterior** de datos, tipo, logo u horarios
(no el de paso) la vuelve a `baseReady: false`: hay que revisarla y guardarla otra vez. Esto no marca los ajustes de cada módulo: el estado de cada
uno lo dice el propio módulo en `modules[].settings.status`.

### Errores
`400` validación (`message` lista de textos y `fields` por campo, como el resto de la API) · `401` sin token o sesión terminada
(`code: "session-expired"`) · `403` token de superadmin, o módulo no asignado (`code: "module-not-enabled"`) · `404` negocio que no administras · `409`
`setup-incomplete` · `413` logo de más de 1 MB.

### Cómo conectar el HTML (`necto-negocios-configuracion`)
| Pantalla / acción del HTML | Backend |
|----------------------------|---------|
| Elegir negocio (`no-business-context`) | `GET /business-access/businesses` (ya existe) y luego `GET /business-setup/businesses/:id` |
| Pantalla de módulos (`negocio-modulos`), «Base preparada» | `modules` y `progress.baseReady` del estado |
| Datos (`negocio-datos`): `name phone email address legal tax website about` | `profile`: `name phone supportEmail address legalName taxId website description` → `PUT /profile` |
| Logo (`no-logo-file`, quitar) | `PUT` / `DELETE /logo`; `logo.url` para mostrarlo |
| Horarios, pestañas Negocio / módulo, «Heredar» | `PUT /schedule`, `PUT /schedule/modules/:id` |
| Tipo (`negocio-tipo`), «Otra» | `PUT /category` (`Otra` → `other` + `categoryOther`) |
| «Perfil de atención de Turnos» (`no-turnos-profile`) | `turnos.profile` / `turnos.profiles` del estado; se guarda con `PUT /category { …, turnosProfile }` |
| Tarjeta de Turnos: «Configurar» / «Revisar configuración» | `modules[].settings.status` (`pending` / `ready`); lleva a `/business/turnos/:id/profile` |
| Siguiente / Atrás entre pasos | `PUT /progress` |
| «Guardar configuración base» | `POST /complete` |
Las claves del HTML (`legal`, `tax`, `email`, `about`, categorías en español) se traducen a las del contrato en el cliente del módulo.
Las claves de categoría: `Gastronomía`→`gastronomy`, `Retail y boutique`→`retail`, `Servicios profesionales`→`professional-services`,
`Salud y bienestar`→`health-wellness`, `Otra`→`other`.

## Módulo turnos
La **configuración** de Turnos de un negocio: perfil de atención, filas, reglas generales y operadores. Referencia visual:
`referencias html/necto-configuracion-turnos.html`. La **operación** (emitir y atender turnos, tablero, encuestas, tiempo real) está más abajo, en «Operación de Turnos».
Colección propia: `turnos_configurations` (un documento por negocio, índices `{ businessId }` único y `{ operators.email }`).

- **Dos roles, dos controladores.** La configuración (`/turnos/businesses/:businessId/…`) es del **administrador** de ese negocio
  (`@RequiresBusinessModule('turnos')`: jefe vigente de un negocio activo que tiene Turnos). La vista del operador
  (`/turnos/businesses/:businessId/operator`) es del **operador** (`@OperatesModule('turnos')`). Se comprueba **en cada petición**, contra la
  base; el negocio de la URL, el rol, los módulos y las filas nunca se toman de lo que envía la página. Sin token `401`; token de
  superadmin `403`; negocio ajeno, inexistente, pausado o mal formado, o ser operador (que no jefe) en una ruta de administrador, **el mismo
  `404`**; Turnos no habilitado en el negocio, `403` con `code: "module-not-enabled"`.
- **Un documento, una escritura.** Filas y operadores viven **dentro** del documento del negocio (MongoDB local no tiene transacciones):
  cualquier cambio que toque a la vez filas y operadores (eliminar una fila y reasignar a quien se quedaría sin ninguna) es **una sola
  escritura condicionada a la `version` leída**; si alguien escribió en medio, el cambio se recalcula sobre lo que escribió (hasta 5
  intentos) y, si no se logra, `409 concurrent-change`. Un negocio nunca muestra un operador sin fila.
- **Primera apertura.** `GET` genera **una vez** las filas sugeridas por el perfil y las guarda (así tienen `id` estables). Abrir de nuevo no
  genera nada. El perfil es el elegido en la configuración base o, si nadie eligió, el que sugiere la categoría (`gastronomy` → `restaurant`,
  `health-wellness` → `clinic`, `retail` y `professional-services` → `bank`, `other` → `custom`). Todos los perfiles, incluido `custom`
  («Atención general»), parten con al menos una fila.
- Todas las respuestas llevan `Cache-Control: no-store`. **Cada escritura devuelve el estado completo** (el mismo del `GET`); `POST /queues` y
  `POST /operators` añaden `created: { id }` con el id de lo creado.

### Estado completo: `GET /turnos/businesses/:businessId`
```json
{
  "business": { "id": "…", "name": "Casa Oliva", "category": "gastronomy", "categoryOther": null },
  "profile": { "id": "restaurant", "suggested": "restaurant", "suggestionsUntouched": true },
  "queues": [
    {
      "id": "…", "name": "Pedidos en caja", "color": "orange", "mode": "auto", "averageMinutes": 8, "source": "restaurant",
      "overrides": { "prefix": null, "urgentMinutes": null, "busyLimit": null, "fullLimit": null },
      "effective": { "prefix": "P", "urgentMinutes": 10, "busyLimit": 4, "fullLimit": 8 },
      "ticketExample": "P-001"
    }
  ],
  "rules": { "prefixMode": "initial", "fixedPrefix": null, "dailyReset": true, "urgentMinutes": 10, "busyLimit": 4, "fullLimit": 8 },
  "operators": [{ "id": "…", "name": "Laura Gómez", "email": "laura@example.com", "phone": null, "queueIds": ["…"], "createdAt": "…" }],
  "progress": { "currentStep": null, "visitedSteps": [], "ready": false, "readyAt": null },
  "catalog": { "profiles": [{ "id": "clinic", "name": "Clínica / Salud", "description": "…", "suggestedQueues": [{ "name": "Consulta general", "mode": "auto", "averageMinutes": 14 }] }], "colors": ["orange", "purple", "blue", "green", "pink", "amber"], "modes": ["auto", "manual"], "prefixModes": ["initial", "fixed", "none"], "steps": ["profile", "queues", "rules", "operators", "review"], "limits": { "…": "…" } }
}
```
- `profile.suggestionsUntouched`: `true` mientras las filas siguen siendo las sugeridas sin tocar y no hay operadores (cambiar el perfil las **reemplaza**); `false`
  cuando hay trabajo de la persona (cambiar el perfil lo conserva): la pantalla debe ofrecer «Solo cambiar perfil» o «Añadir sugerencias».
- `queues[].source`: `"custom"` (la creó la persona) o el id del perfil que la sugirió («Sugerida · Clínica / Salud» en la pantalla).
- `queues[].overrides`: lo que la fila fija **por su cuenta**; `null` es «usa la regla general», **campo por campo**. `effective` es lo que la fila usa de
  verdad (propio o heredado) y `ticketExample` el número de ejemplo (`C-001`, `T-001`, `001`): la pantalla no necesita recalcular la herencia.
- `catalog` trae lo que la interfaz necesita para validar igual que el servidor: perfiles con sus filas sugeridas, colores, modos, límites.
  `limits`: nombre de fila 2 a 60, promedio 1 a 1440 min, prefijo 1 a 5 letras o dígitos, urgencia 1 a 1440, ocupada 1 a 9999, llena 1 a 10000
  (la **general** parte de 2), operador 2 a 80 caracteres, teléfono 7 a 15 dígitos, hasta 30 filas y 100 operadores por negocio (límites propios del producto).

### Rutas de la configuración (tras `/turnos/businesses/:businessId`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| `GET` | `` | Estado completo (la primera vez genera las filas sugeridas). |
| `PUT` | `/profile` | `{ profile, addSuggestedQueues? }`: cambia el perfil de atención. |
| `POST` | `/queues` · `PUT /queues/:queueId` · `DELETE /queues/:queueId` | Crear (`201`), reemplazar lo editable, eliminar. |
| `PUT` | `/rules` | Reglas generales. |
| `POST` | `/operators` · `PUT /operators/:operatorId` · `DELETE /operators/:operatorId` | Crear (`201`), reemplazar, retirar. |
| `PUT` | `/progress` | `{ step }`: recuerda el paso actual (`profile`, `queues`, `rules`, `operators`, `review`). |
| `POST` | `/complete` | «Guardar configuración»: la marca como preparada. |

**Cambiar el perfil** (`PUT /profile`, y también `turnosProfile` en la configuración base): **nunca borra ni duplica** lo que hizo la persona.
- Si las filas siguen siendo las sugeridas sin tocar (nadie editó filas, reglas ni operadores) y no hay operadores, se **reemplazan** por las del nuevo perfil.
- Si no, filas, reglas y operadores quedan **exactamente** como están y solo cambia el perfil. Con `addSuggestedQueues: true` se **añaden** las
  sugeridas del nuevo perfil, saltando las que ya existen por nombre (sin distinguir mayúsculas): pedirlo otra vez no añade nada.
- El mismo perfil sin `addSuggestedQueues` no cambia nada. Un perfil desconocido: `400` con `fields.profile`.

**Filas** — `{ name, mode, averageMinutes, color?, overrides? }` con `overrides: { prefix?, urgentMinutes?, busyLimit?, fullLimit? }`:
nombre único en el negocio (sin distinguir mayúsculas), `mode` `auto` o `manual`, `color` de la paleta (si falta, se elige uno), y cada valor propio
**opcional e independiente**: omitido o `null` hereda el general. El prefijo propio se normaliza a mayúsculas sin tildes. `PUT` **reemplaza**: un campo de
`overrides` que no se envía vuelve a heredar. Errores `400` con `code: "invalid-queue"` y `fields` (`name`, `mode`, `color`, `averageMinutes`, `overrides.prefix`…).

**Reglas** — `{ prefixMode: "initial" | "fixed" | "none", fixedPrefix?, dailyReset, urgentMinutes, busyLimit, fullLimit }`.
`fixedPrefix` es obligatorio solo con `fixed` (y se guarda `null` con los otros modos). `fullLimit` debe ser **mayor** que `busyLimit`.

**Límite de llena mayor que el de ocupada, con valores heredados y propios.** Se valida con lo que la fila **realmente** usa (propio o general):
- Al guardar una fila: una `busyLimit` propia que alcanza la `fullLimit` **heredada**, o una `fullLimit` propia que no supera la `busyLimit` heredada, se rechaza
  (`400`, `fields["overrides.fullLimit"]`).
- Al guardar las reglas generales: si cruzarían con los valores propios de alguna fila, se rechaza (`400`, `fields.fullLimit`) nombrando las filas, y no cambia nada.
- Al guardar como preparada se vuelve a comprobar todo.

**Operadores** — `{ name, email, phone?, queueIds }`: nombre (2 a 80) y correo **obligatorios**, teléfono opcional (se limpia: `+573001234567`),
y **una o varias** filas **existentes de este negocio** (un id de otro negocio, o ninguno, es `400` con `fields.queueIds`). El correo es con el que
entra, se normaliza como en el login (sin espacios, en minúsculas) y es único entre los operadores del negocio (`400` con `fields.email`); la misma
persona sí puede ser operadora de varios negocios. Agregar operadores es **opcional**. Quitar un operador (`DELETE`) elimina **solo su asignación a
Turnos de este negocio**: no borra su identidad (que es solo el correo), ni sus sesiones, ni sus accesos a otros negocios o roles.

**Eliminar una fila** — `DELETE /queues/:queueId` con cuerpo opcional `{ reassignments: [{ operatorId, queueId }] }`:
- Quien tiene **otras** filas solo pierde esta. Quien se quedaría **sin ninguna** necesita una nueva fila en `reassignments`.
- Si falta alguno: `409` con `code: "reassignment-required"` y `fields["reassignments.<operatorId>"]` por cada persona; **no se elimina nada**.
- Una reasignación hacia la fila eliminada, hacia una fila que no existe o es de otro negocio, para alguien que no la necesita o repetida: `400` con
  `fields["reassignments.<n>.…"]`.
- Es la única fila del negocio y tiene operadores (no hay a dónde moverlos): `409` con `code: "queue-has-operators"`.
- Fila y operadores cambian en **una sola escritura**: o pasa todo o no pasa nada, y nadie queda sin fila.

**Guardar la configuración** — `POST /complete` exige **al menos una fila** y **reglas válidas** (y que filas y operadores sigan siendo válidos);
los operadores son opcionales. Marca `progress.ready` y `readyAt`; repetirlo conserva la fecha. Si no se cumple: `409` con `code: "turnos-incomplete"` y
`fields` (`queues`, `rules.<campo>`, `queues.<id>.…`, `operators.<id>.…`). **Cualquier cambio posterior** de perfil con efecto, filas, reglas u
operadores la vuelve a `ready: false`; mover el paso (`PUT /progress`) no. **Recuperar**: `GET` devuelve todo lo guardado, también tras cerrar sesión.

### Vista del operador: `GET /turnos/businesses/:businessId/operator`
```json
{ "business": { "id": "…", "name": "Casa Oliva" }, "operator": { "id": "…", "name": "Laura Gómez", "email": "laura@example.com" },
  "queues": [{ "id": "…", "name": "Laboratorio", "color": "purple", "mode": "manual", "averageMinutes": 25 }] }
```
El operador se busca por el **correo de la sesión** (nunca por algo que envíe la página) y la respuesta trae **solo sus filas**: sin reglas, sin otros
operadores, sin ninguna ruta administrativa. Es de solo lectura; no concede acceso a otros módulos del negocio. Si se le quita la asignación o su última fila,
se deshabilita Turnos o se pausa el negocio, responde `404` en la petición siguiente.

### Login compartido
El operador entra por `/business-access` (ver ese módulo), con su correo y un código real enviado por correo (vencimiento, un solo uso y los mismos
límites de solicitudes e intentos). No existe ningún código de prueba. `verify` y `GET /business-access/accesses` devuelven `accesses[]` con
`role: "admin" | "operator"`; con más de uno se elige negocio y rol. Turnos se registra como fuente de asignaciones al arrancar
(`TurnosOperatorAccessSource`) y solo cuenta a un operador que conserva al menos una fila existente.

### Errores del módulo
`400` validación (`message` lista y `fields`; `code` `invalid-queue`, `invalid-rules`, `invalid-operator`, `invalid-profile`, `invalid-request`) ·
`401` sin token o sesión terminada (`session-expired`) · `403` token de superadmin, o `module-not-enabled` · `404` negocio, fila u operador que no es tuyo ·
`409` `reassignment-required`, `queue-has-operators`, `turnos-incomplete`, `concurrent-change`.

### Contrato público (`turnos/public.ts`)
`TurnosBaseSetup`, que usa la configuración base: opciones de perfil, perfil vigente, elegirlo y el estado de Turnos (`ready`, filas, operadores). Quien
elige el perfil debe ser el jefe vigente de un negocio activo con Turnos, comprobado en la misma operación.

### Cómo conectar el HTML (`necto-configuracion-turnos`)
| Pantalla / acción del HTML | Backend |
|----------------------------|---------|
| Tarjeta de Turnos en los módulos, «Configurar» / «Revisar configuración» | `modules[].settings.status` de `GET /business-setup/businesses/:id` |
| `turnos-perfil`: tarjetas de perfil y filas sugeridas | `catalog.profiles`, `profile.id`; `PUT /profile` |
| Diálogo «Añadir otras filas sugeridas» (`nt-change-profile-*`) | «Solo cambiar perfil» → `addSuggestedQueues: false`; «Añadir sugerencias» → `true` |
| `turnos-filas`: lista, «Nueva fila», editar, eliminar | `queues[]`; `POST` / `PUT` / `DELETE /queues` |
| Diálogo de fila: nombre, modo, promedio, color, reglas propias | cuerpo de fila; `overrides` vacío = «General: …» (`rules`) |
| `turnos-reglas`: prefijo, reinicio, urgencia, ocupada, llena | `PUT /rules` |
| `turnos-operadores`: alta, edición, filas por operador | `POST` / `PUT /operators`; `queueIds` |
| «Continuar sin agregar» operadores | no hace falta llamar nada: los operadores son opcionales |
| Diálogo «Eliminar fila» con reasignación (`nt-delete-reassign`) | `DELETE /queues/:id` con `reassignments`; `409 reassignment-required` lista a quién falta |
| «Ver acceso OTP» / «Probar su acceso» | el operador entra por `/business/access` con su correo; el código real llega por correo |
| `turnos-revision` y «Guardar configuración» | `POST /complete` |
| `turnos-acceso-operador` | `GET /turnos/businesses/:id/operator` |
| Siguiente / Atrás entre pasos | `PUT /progress` |
Las claves del HTML (`average`, `queueIds`, `urgent`, `busy`, `full`, `prefixMode: 'initial'`) se traducen a las del contrato en el cliente del módulo.

## Operación de Turnos (módulo `turnos`)
Emitir, buscar, llamar y atender turnos; el tablero del administrador (métricas, equipo, actividad, reporte CSV), la pantalla de sala, las encuestas
de satisfacción y las actualizaciones en tiempo real. Sigue siendo el **mismo módulo** `turnos` (la configuración y la operación comparten filas, reglas y
operadores), con tres colecciones nuevas: `turnos_tickets` (los turnos), `turnos_counters` (la numeración) y `turnos_surveys` (invitaciones y respuestas).
No incluye Reservas, Agendamiento, Referidos, Inventario ni Pedidos.
### Quién puede qué (se valida en CADA petición y en cada conexión en vivo)
| Rol | Rutas | Qué puede |
|-----|-------|-----------|
| **Administrador** (jefe vigente, negocio activo, Turnos habilitado) | `/turnos/businesses/:businessId/insights/*` y la configuración | **Mira** todo el negocio (tablero, equipo, turnos, reportes, encuestas) y **configura** (operadores, permisos, pantalla de sala, encuestas, pausar filas). **No** crea, llama ni completa turnos: eso lo hacen los operadores. |
| **Operador** (asignado, `active`, con al menos una vista y una fila) | `/turnos/businesses/:businessId/operation/*` | Solo lo que su administrador le dio: **vistas** (Inicio, Mis turnos, Crear turno, Filas, Encuestas) y **filas**. Nunca configura nada. |
- **Dos controladores, dos pares de guards.** Operación: `@OperatesModule('turnos')` (operador de ESE negocio, negocio activo, módulo habilitado) + `TurnosOperatorScopeGuard`,
  que busca su asignación **por el correo de la sesión**, exige que esté `active` y con la **vista** que declara la ruta (`@RequiresView`). Administrador: `@RequiresBusinessModule('turnos')`
  + `TurnosAdminScopeGuard`. Un operador en una ruta de administrador, y un jefe en una de operador, reciben `403`/`404`. El negocio, el rol, la vista y las filas **nunca** se leen de lo que
  envía la página: salen de la sesión y de los datos del momento.
- **Los permisos cambian en sesiones abiertas.** Nada del rol, las vistas ni las filas va en el token ni se copia en `business-access`: cada petición vuelve a leer la configuración.
  Si el administrador le quita una vista, la siguiente petición con el **mismo token** responde `403 view-not-allowed`; si lo apaga o le quita todas las vistas, deja de entrar.
  Si estaba atendiendo un turno, el turno **vuelve a la fila en su lugar** (evento `released`) y otro operador puede llamarlo.
- **Estados del operador**: `pending` (recién asignado), `active` (puede operar) e `inactive` (apagado por el administrador). El **primer inicio de sesión con código** lo pasa de `pending`
  a `active` (`business-access` publica `MemberSignedIn` y `turnos` lo escucha). Un `inactive` no se reactiva solo. Sin vistas no hay acceso: ni siquiera se envía el código.
  Un operador `pending` que ya tiene sesión por otro acceso no puede operar hasta volver a entrar (`accesses[].operable: false`).
- **Vistas** (`views`, en el orden en que se ofrecen): `home` (Inicio), `my-turns` (Mis turnos: ver, buscar, llamar, completar, cancelar, ausente), `create-turn` (Crear turno), `queues`
  (Filas: ver estado y pausar/reanudar las suyas), `surveys` (Encuestas). La **primera** que tiene es donde aterriza al entrar (`accesses[].firstView`): va directo a su módulo,
  sin pasar por el tablero general.
- **Errores de permisos**: `403` con `code` `view-not-allowed` (no tiene esa vista), `operator-not-operable` (pendiente, apagado, sin vistas o sin filas), `operator-required` (el administrador en una acción de operador),
  `administrator-required` (un operador en algo del administrador, p. ej. equipo, reporte o ajustes). Una fila, turno o respuesta **de otra fila** se responde `404`, igual que si no existiera.
### Configuración nueva (se edita con las rutas de configuración de siempre)
- **Fila**: `status` (`active` | `paused`) y `fields` (campos adicionales al crear un turno). `PUT /queues/:id` con `fields` los **reemplaza**; sin `fields` los conserva.
  Un campo es `{ id?, label, type, required?, options? }`; `type`: `text`, `number`, `phone`, `email`, `date`, `select` (necesita 2 a 20 `options`), `checkbox`. Hasta 10 por fila, etiqueta 2 a 60, sin etiquetas
  repetidas. El `id` se conserva (las respuestas se guardan con él); si falta se genera.
- **Operador**: `views` (lista; sin enviarla se conservan, y un operador nuevo parte con todas) y `status` (`active` | `inactive`; un operador nuevo parte `pending`). Las vistas se guardan en el orden del espacio de trabajo,
  sin importar cómo se envíen. Quien ya inició sesión no vuelve a `pending`.
- `GET /turnos/businesses/:businessId` ahora trae también `roomScreen`, `survey` y en `catalog`: `operatorViews`, `operatorStatuses`, `queueStatuses`, `fieldTypes`, `ticketStatuses`, `roomNameDisplays`, `ranges` y `limits`.
- **Eliminar una fila con turnos esperando o en atención** → `409 queue-has-open-turns`. Las restricciones de reasignación de operadores (`reassignment-required`, `queue-has-operators`) siguen igual.
### El turno
Estados: `waiting` → `attending` → `completed`; `cancelled` (desde esperando o en atención) y `no-show` (ausente: lo llamaron y no llegó).
```json
{ "id": "…", "code": "P-001", "queue": { "id": "…", "name": "Pedidos en caja" }, "status": "attending",
  "customer": { "name": "Ana Pérez", "phone": "+573001234567", "email": "ana@example.com" },
  "answers": [{ "fieldId": "doc", "label": "Documento", "type": "text", "value": "123" }], "note": null,
  "createdAt": "…", "createdBy": { "id": "…", "name": "Laura Gómez" }, "calledAt": "…", "attendedBy": { "id": "…", "name": "Laura Gómez" },
  "finishedAt": null, "cancelReason": null, "waitMinutes": 4, "serviceMinutes": null }
```
`GET /operation/tickets/:id` y `/insights/tickets/:id` añaden `events: [{ type, at, by, automatic }]` (`created`, `called`, `completed`, `cancelled`, `no-show`, `released`; `automatic: true` en la llamada que hace la fila sola).
- **Numeración.** Código = prefijo efectivo de la fila (propio, general o su inicial) + `-` + número de al menos 3 dígitos (`C-001`, `001`). El contador es **atómico** (`findOneAndUpdate` con `$inc` sobre `turnos_counters`), por prefijo dentro de un
  ámbito: el día del negocio **en su zona horaria** si `dailyReset` (reinicia a medianoche local) o «todos» si no. Dos filas con el mismo prefijo comparten la cuenta: **nunca hay códigos repetidos en un día** (además lo garantiza
  un índice único `{businessId, dayKey, code}`; si por un cambio de modo un código ya existe, se toma el siguiente número). El orden de llamada es el de llegada.
- **Crear** (`POST /operation/queues/:queueId/tickets`, vista `create-turn`): `{ customerName?, customerPhone?, customerEmail?, note?, answers?, clientRequestId? }`. La fila debe ser del operador y no estar pausada (`409 queue-paused`).
  Los `answers` se validan contra los campos de la fila: obligatorios, tipo (número, teléfono, correo, fecha `AAAA-MM-DD`, opción de la lista, casilla) y sin respuestas a campos que la fila no pide; los errores salen por campo
  (`fields["answers.<id>"]`, `code: "invalid-ticket"`). `201` con el turno nuevo; con el mismo `clientRequestId` (8 a 64 caracteres) devuelve `200` con `created: false` y **el mismo turno**: un doble clic no crea dos.
- **Llamar.** `POST /operation/tickets/:id/call` y `POST /operation/queues/:id/call-next` (vista `my-turns`). En una fila **manual** se elige a quién llamar; en una **automática** solo el siguiente por orden de llegada (`409 not-next-in-line`).
  Un operador atiende **un turno a la vez**: llamar otro mientras tiene uno responde `409 operator-busy` (lo garantiza un índice único parcial en la base, no solo el código). Fila vacía: `409 queue-empty`.
- **Completar** (`POST /operation/tickets/:id/complete`). En una fila **automática**, al completar se llama **al siguiente por orden de llegada**, con una sola escritura atómica; la respuesta lo trae en `next`.
  Si la persona no llegó: `no-show`; también `cancel` con `{ reason? }`. No se llama al siguiente automáticamente al cancelar o marcar ausente: solo al completar.
- **Atómico e idempotente.** Cada cambio de estado es **una escritura condicionada al estado esperado**. Repetir lo que ya está hecho responde `200` con `applied: false` y no cambia nada ni llama a otro turno; que otro operador ya lo tomó, `409 ticket-already-taken`;
  un estado que no admite el cambio, `409 invalid-ticket-state`. Dos operadores llamando al mismo turno a la vez: solo uno lo logra. Seis «completar» simultáneos: uno se aplica.
- **Pausar una fila** (`POST …/queues/:id/pause` y `…/resume`; administrador, o un operador con la vista `queues` en sus filas): no entran turnos nuevos, los existentes se conservan y se pueden atender. Es un interruptor operativo: **no** invalida «configuración preparada».
- **Listar y buscar** (`GET /operation/tickets`, `GET /insights/tickets`): `queueId`, `status` (uno o varios separados por coma), `search` (código, nombre, teléfono o correo; sin distinguir mayúsculas y sin interpretar patrones), `range` (`today`, `yesterday`, `7d`, `30d`) o `from`/`to` (`AAAA-MM-DD`, hasta 92 días, en la zona del negocio),
  `mine=true` (los que llamó el operador), `operatorId` (solo administrador), `order` (`newest` por defecto o `arrival`), `page`, `pageSize` (máx. 100). Respuesta `{ items, total, page, pageSize }`. Filtros inválidos: `400 invalid-filter` con `fields`.
### Tablero y herramientas
Todo se **cuenta de los turnos reales**; si no hay datos, `0` y `null` (nunca un número inventado). Los rangos usan los días del negocio en su zona horaria.
| Ruta | Quién | Respuesta |
|------|-------|-----------|
| `GET /operation/home` · `GET /insights/overview` | operador (`home`) · administrador | `{ range, totals, mine, queues[], daily[], hourly[], truncated, generatedAt }`. `totals`: `created`, `completed`, `cancelled`, `noShow`, `called`, `averageWaitMinutes`, `averageServiceMinutes`, `completionRate`, `noShowRate`. `queues[]`: estado actual (`waiting`, `attending`, `longestWaitMinutes`, `urgent`, `state`: `empty`/`normal`/`busy`/`full`/`paused`, con los límites propios o heredados) y sus `metrics`. `daily`: un punto por día del rango (con los días vacíos); `hourly`: 24 horas locales. `mine` solo para el operador. `home` añade `current` (su turno en atención) y `activity`. |
| `GET /insights/team` | administrador | `members[]`: por operador, `attended`, `completed`, `noShow`, `cancelled`, `averageServiceMinutes`, `current`. Incluye a quien fue retirado pero trabajó en el rango. |
| `GET /operation/activity` · `GET /insights/activity?limit=` | operador (`home`) · administrador | Lo último que pasó a los turnos, el más reciente primero (máx. 100). |
| `GET /operation/queues` · `GET /insights/queues` | operador (`queues`) · administrador | Estado de cada fila. |
| `GET /insights/tickets.csv` | administrador | Reporte con los mismos filtros (hoy si no se da rango). `text/csv; charset=utf-8` con BOM, `Content-Disposition: attachment`, `X-Report-Rows` y `X-Report-Truncated` (máx. 20 000 filas). Un texto que empieza por `=`, `+`, `-` o `@` lleva un apóstrofo delante para que la hoja de cálculo no lo ejecute como fórmula. Columnas: `code,queue,status,day,created_at,called_at,finished_at,wait_minutes,service_minutes,operator,customer_name,customer_phone,customer_email,note,cancel_reason,answers`. |
| `GET` · `PUT /insights/room-screen` | administrador | Ajustes de la pantalla de sala `{ enabled, queueIds\|null, customerName: full\|first-name\|hidden, playSound, recentCalls 1..10, message }` y las últimas llamadas que mostraría (con el nombre ya recortado según el ajuste). Solo la configuración: la pantalla en sí es otra etapa. Quitar una fila de la selección o eliminarla la saca; una selección vacía vuelve a «todas». |
### Encuestas de satisfacción
- **Ajustes** (`GET`/`PUT /insights/surveys/config`, administrador): `{ enabled, channels: { email, whatsapp }, question, allowComment, thanksMessage?, validHours 1..720, queueIds|null }`. Empiezan **apagadas**.
- **Invitación.** Al **completar** un turno de una fila con encuesta, se crea **una** invitación (una por turno, aunque se complete dos veces) con un enlace privado `…/turnos/survey/<token>` (el token son 256 bits al azar y en la base solo se guarda su hash). Se envía por el **correo que la plataforma ya tiene** (`MailTransport`).
- **Sin éxitos ficticios.** `delivery.email.status`: `accepted` (el proveedor aceptó el mensaje; **no** significa que llegó), `failed` (con `failureCode`), `not-configured` (no hay proveedor de correo: no se envió nada), `no-contact` (el cliente no dejó correo), `not-requested`, `pending`.
  `delivery.whatsapp`: **no existe proveedor de WhatsApp** en este backend: pedirlo queda en `not-configured` (o `no-contact`), nunca `accepted`.
- **El cliente responde sin iniciar sesión**, solo con el enlace: `GET /turnos/surveys/:token` (`{ businessName, queueName, question, allowComment, thanksMessage, expiresAt, closed: false|"answered"|"expired" }`) y
  `POST /turnos/surveys/:token` `{ rating 1..5, comment? }`. La primera respuesta válida gana (dos a la vez: se guarda una), una segunda o fuera de plazo responde `409 survey-closed`, un enlace desconocido `404`. Con límite de peticiones.
- **Cálculos** (`GET /insights/surveys/summary` y `GET /operation/surveys/summary`, `range`/`from`/`to`, `queueId`, `operatorId` solo administrador): `overall` (`invited`, `responses`, `responseRate`, `average`, `satisfied` = % de 4 y 5, `distribution` 1 a 5), `trend` (un punto por día, `average: null` sin respuestas),
  `byQueue[]` y `byOperator[]`. Sin respuestas todo es `null`, no `0`. Listado de respuestas: `GET …/surveys/responses` (`rating`, `queueId`, `page`, `pageSize`), la más reciente primero, con `delivery` solo para el administrador.
- **Mismos permisos**: el operador necesita la vista `surveys`, ve **solo sus filas** y de los operadores **solo su propia fila**; pedir otra fila es `400 invalid-filter`.
### Tiempo real (Server-Sent Events)
`GET …/operation/events` (operador) y `GET …/insights/events` (administrador). Se abren con `fetch` y la cabecera `Authorization: Bearer …` (`EventSource` no puede enviarla); el cuerpo es `text/event-stream`.
| Evento | Cuándo | Datos |
|--------|--------|-------|
| `ready` | al conectar | `{ role, queueIds, views, firstView }` (lo que la persona puede ver) |
| `ticket.created` · `ticket.called` · `ticket.completed` · `ticket.cancelled` · `ticket.no-show` · `ticket.released` | cambia un turno | `{ type, at, queueId, ticket }` con el turno completo solo para quien atiende (`my-turns`/`create-turn`) o el administrador; para el resto solo `{ id, code, status }` |
| `queue.paused` · `queue.resumed` | se pausa o reanuda una fila | `{ type, at, queueId }` |
| `config.updated` | cambia la configuración (filas, reglas, operadores, encuesta) | `{ type, at }`: volver a pedir la configuración |
| `survey.answered` | llega una respuesta | `{ type, at, queueId }` (vista `surveys`) |
| `room-screen.updated` | cambian los ajustes de la sala | solo administrador |
| `access.updated` | el administrador cambió los permisos de ESTA persona | `{ role, queueIds, views, firstView }` nuevos |
| `access.revoked` | la persona ya no tiene acceso (sesión terminada, apagada, retirada, negocio pausado, módulo deshabilitado) | la conexión se cierra |
| `ping` | cada 15 s | revalida el acceso |
- **Autorización viva.** Al abrir pasan los mismos guards que cualquier ruta. Con la conexión abierta, cada evento (a lo sumo cada 5 s) y cada latido vuelven a comprobar sesión, rol en el negocio, módulo y estado, vistas y filas del operador (`BusinessAccessChecks`).
  Cada evento se filtra por lo que la persona puede alcanzar **en el momento de entregarlo**: un operador nunca recibe turnos de filas que no son suyas ni de otro negocio.
- **Alcance.** El canal vive en la memoria del proceso: con varias instancias del backend un evento solo llega a las conexiones de la instancia que lo produjo (es la única pieza a cambiar por un canal compartido el día que se escale). No hay reenvío de eventos perdidos:
  tras reconectar, la pantalla vuelve a pedir lo que muestra. Si hay un proxy, debe dejar pasar `text/event-stream` sin almacenarlo.
### Cómo conectar los HTML (guía de rutas)
En desarrollo el dev server de Vite redirige `/api/turnos` y `/api/dashboard` al backend quitando ese prefijo (ya están en `vite.config.ts`), así que la página llama, por ejemplo, a `/api/turnos/turnos/businesses/:id/operation/home` y a `/api/dashboard/dashboard/businesses/:id`. Todas las rutas llevan `Authorization: Bearer <accessToken>` (el de `business-access`, que se renueva con `POST /business-access/session/refresh`), menos las de la encuesta del cliente.
| Pantalla | Backend |
|----------|---------|
| Tras el login: elegir acceso | `accesses[]` de `otp/verify`/`session/refresh`: `role`, `businessId`, `modules`, `views`, `firstView`, `operable`. Administrador → `GET /dashboard/businesses/:id`; operador → su `firstView` |
| Dashboard general del administrador | `GET /dashboard/businesses/:businessId` (ver el módulo `business-dashboard`) |
| Turnos · Inicio (operador) | `GET /operation/home`, `GET /operation/events` |
| Turnos · Mis turnos | `GET /operation/tickets` (filtros), `GET /operation/tickets/current`, `POST /operation/tickets/:id/{call,complete,cancel,no-show}`, `POST /operation/queues/:id/call-next` |
| Turnos · Crear turno | `GET /turnos/businesses/:id/operator` (filas con sus `fields`), `POST /operation/queues/:id/tickets` |
| Turnos · Filas | `GET /operation/queues`, `POST /operation/queues/:id/{pause,resume}` |
| Turnos · Encuestas | `GET /operation/surveys/summary`, `GET /operation/surveys/responses` |
| Tablero del administrador | `GET /insights/overview`, `/team`, `/activity`, `/queues`, `/tickets`, `/tickets.csv` |
| Pantalla de sala (ajustes) / Encuestas (ajustes) | `GET`/`PUT /insights/room-screen`, `GET`/`PUT /insights/surveys/config` |
| Página pública de la encuesta | `GET`/`POST /turnos/surveys/:token` (la ruta del enlace del correo es `/turnos/survey/<token>` en la app web) |
### Errores de la operación
`400` `invalid-ticket`, `invalid-filter`, `invalid-answer`, `invalid-room-screen`, `invalid-survey` (con `fields`) · `403` `view-not-allowed`, `operator-not-operable`, `operator-required`, `administrator-required` ·
`404` fila, turno o encuesta que no es tuyo o no existe · `409` `queue-paused`, `operator-busy`, `queue-empty`, `not-next-in-line`, `ticket-already-taken`, `invalid-ticket-state`, `queue-has-open-turns`, `survey-closed`, `numbering-busy`.
### Contrato público añadido
`turnos/public.ts` exporta además `TurnosDashboard` (los indicadores reales de Turnos para el dashboard general). `business-access/public.ts`: `MemberSignedIn`, `BusinessAccessChecks`, y `MemberAssignment.views/operable` /
`AccessGrant.views/firstView/operable`. `business-setup/public.ts`: `BusinessSetupOverview` (estado de la base y de cada módulo asignado).
## Módulo business-dashboard
El **dashboard general** del administrador. No tiene datos propios: lee la configuración base y el estado de cada módulo por la puerta pública de `business-setup` (`BusinessSetupOverview`) y los indicadores de Turnos por la de `turnos` (`TurnosDashboard`).
`GET /dashboard/businesses/:businessId` (`@AdministersBusiness()`: jefe vigente de un negocio activo; un operador nunca entra: va directo a su módulo).
```json
{
  "entry": "dashboard",
  "business": { "id": "…", "name": "Casa Oliva", "category": "gastronomy", "categoryOther": null, "status": "active", "timezone": "America/Bogota" },
  "setup": { "baseReady": true, "baseReadyAt": "…", "next": null, "pendingModules": [], "configurableModules": 1, "readyModules": 1 },
  "modules": [{ "id": "turnos", "name": "Turnos", "description": "…", "configurable": true, "operational": true, "setup": { "status": "ready", "summary": { "queueCount": 2, "operatorCount": 3 } }, "openNow": true,
    "indicators": { "turnos": { "queues": { "total": 2, "paused": 0 }, "operators": { "total": 3, "active": 2, "pending": 1, "inactive": 0 },
      "today": { "created": 12, "waiting": 3, "attending": 1, "completed": 8, "cancelled": 0, "noShow": 0, "averageWaitMinutes": 4.5, "averageServiceMinutes": 6.1 }, "satisfaction": { "average": 4.6, "responses": 9 } } } }],
  "generatedAt": "…"
}
```
- **`entry`**: `dashboard` cuando la base está preparada **y** todo módulo asignado que ya se puede configurar tiene su configuración preparada; `setup` mientras falte algo, y `setup.next` dice qué sigue: `{ step: "base" }` o `{ step: "module", moduleId }`.
- **Solo lo asignado.** `modules` trae únicamente los módulos del negocio. Un módulo asignado que **todavía no tiene configuración** (Reservas, Agendamiento, Referidos, Inventario) aparece con `configurable: false`, `operational: false` y `indicators: null`, y **no** impide entrar al dashboard.
  Pedidos tiene configuración (cuenta para `entry`) pero aún no operación (`operational: false`, `indicators: null`).
- **Indicadores reales.** `indicators.turnos` solo existe si Turnos está asignado y su configuración está preparada; se calculan de los turnos y respuestas del día del negocio y de los últimos 30 días (satisfacción). `null` donde no hay datos: nunca se inventa una métrica.
## Módulo pedidos
La **configuración** de Pedidos de un negocio en 7 pasos: perfil operativo, modalidades de entrega, despacho y logística, pagos y políticas, tiempos y alertas (SLA), operadores por etapa y revisión final. **Todavía no** recibe ni gestiona pedidos operativos, tableros de preparación ni métricas de entrega.
Colección propia: `pedidos_configurations` (un documento por negocio, índices `{ businessId }` único y `{ operators.email }`).

- **Dos roles, dos controladores.** La configuración (`/pedidos/businesses/:businessId/…`) pertenece al **administrador** del negocio (`@RequiresBusinessModule('pedidos')`: jefe vigente de un negocio activo con Pedidos habilitado). La vista del operador (`/pedidos/businesses/:businessId/operator`) pertenece al **operador** (`@OperatesModule('pedidos')`). Cada petición valida sesión, negocio y rol contra la base; sin token `401`, token de superadmin `403`, negocio ajeno/inexistente/pausado o rol incorrecto `404`, módulo no habilitado `403` con `code: "module-not-enabled"`.
- **Un documento versionado por negocio.** Modalidades, logística, pagos, SLA, operadores y progreso viven dentro de un único documento (`version` con bloqueo optimista y reintentos; si se agotan, `409 concurrent-change`).
- **Primera apertura y horario efectivo.** El primer `GET` inicializa una vez la configuración con la plantilla del perfil sugerido por la categoría del negocio (`gastronomy` → `food`, `retail`/`other` → `general`, `professional-services`/`health-wellness` → `services`) y la persiste (`seeded: true`). Además consulta a `business-setup` (`BusinessScheduleReader`) para devolver el horario efectivo del módulo (`timezone`, `inherit`, `openNow`, `days`).
- Todas las respuestas llevan `Cache-Control: no-store`. **Cada escritura devuelve el estado completo** (la misma forma del `GET`); `POST /operators` responde `201` y añade `created: { id }`.

### Estado completo: `GET /pedidos/businesses/:businessId`
```json
{
  "business": { "id": "…", "name": "Casa Oliva", "category": "gastronomy", "categoryOther": null, "currency": "COP", "timezone": "America/Bogota" },
  "profile": { "id": "food", "suggested": "food" },
  "schedule": { "timezone": "America/Bogota", "inherit": true, "openNow": true, "days": { "mon": { "open": true, "ranges": [{ "start": "08:00", "end": "18:00" }] } } },
  "modalities": ["delivery", "pickup", "on_site"],
  "onSiteMode": "table_or_zone",
  "fulfillment": {
    "hasOwnCourier": true,
    "carriers": [{ "id": "servientrega", "name": "Servientrega", "enabled": true, "isDefault": true }],
    "pickupMode": "eventual",
    "confirmationMode": "manual",
    "whatsappNumber": "",
    "riskThresholdActive": false,
    "maxShippingCostRisk": 15000,
    "shippingPricingMode": "fixed",
    "flatShippingFee": 6000,
    "freeShippingThreshold": 60000,
    "minimumOrderActive": true,
    "minimumOrderAmount": 20000
  },
  "payments": {
    "methods": ["cash_on_delivery", "bank_transfer", "in_store"],
    "requireTransferReceipt": true,
    "requirePrepaymentBeforePrep": false,
    "confirmationExpiryAction": "alert_only",
    "cancellationLimit": "before_preparation"
  },
  "sla": {
    "confirmationMinutes": 5,
    "preparationMinutes": 25,
    "dispatchMinutes": 30,
    "urgencyThresholdMinutes": 15,
    "outOfHoursPolicy": "reject",
    "outOfHoursAutoReply": true,
    "outOfHoursMessage": "Hola, nuestro horario de atención ha finalizado. Te responderemos a primera hora."
  },
  "operators": [{ "id": "…", "name": "Camila Ruiz", "email": "camila@example.com", "phone": "+573001234567", "stages": ["confirmation", "preparation", "dispatch"], "createdAt": "…" }],
  "progress": { "currentStep": "profile", "visitedSteps": ["profile"], "ready": false, "readyAt": null, "touched": false }
}
```

### Rutas de la configuración (tras `/pedidos/businesses/:businessId`)
| Método | Ruta | Qué hace |
|--------|------|----------|
| `GET` | `` | Estado completo (en la primera apertura inicializa la plantilla del perfil sugerido). |
| `PUT` | `/profile` | `{ profile }`: aplica la plantilla del perfil (`food`, `fashion`, `general`, `services`), conserva los operadores y reinicia `touched: false` y `ready: false`. |
| `PUT` | `/modalities` | `{ modalities, onSiteMode }`: guarda modalidades activas (`delivery`, `pickup`, `on_site`) y modo de consumo en sitio (`table_or_zone`, `counter`). |
| `PUT` | `/fulfillment` | Guarda logística propia/transportadoras, recogida, confirmación, WhatsApp, flete, riesgo y monto mínimo. |
| `PUT` | `/payments` | Guarda medios de pago, comprobante, prepago antes de preparar, vencimiento de confirmación y límite de cancelación. |
| `PUT` | `/sla` | Guarda tiempos de confirmación, preparación, despacho, alerta de urgencia y atención fuera de horario. |
| `POST` | `/operators` | Crea un operador (`201`, devuelve el estado completo + `created: { id }`). |
| `PUT` | `/operators/:operatorId` | Reemplaza nombre, correo, teléfono y etapas (`confirmation`, `preparation`, `dispatch`) de un operador. |
| `DELETE` | `/operators/:operatorId` | Retira la asignación del operador en Pedidos para este negocio (sin borrar su identidad ni otros accesos). |
| `PUT` | `/progress` | `{ currentStep, visitedSteps }`: recuerda paso actual y pasos visitados sin cambiar `touched` ni `ready`. |
| `POST` | `/complete` | Valida todas las secciones y marca la configuración como preparada (`ready: true`, `readyAt`, `currentStep: "review"`). |

### Reglas de dominio e invariantes
- **Modalidades:** al menos una modalidad activa (`delivery`, `pickup` u `on_site`). Si `on_site` está activo, `onSiteMode` es `table_or_zone` o `counter`.
- **Logística (`fulfillment`):** cuando `delivery` está activo y `hasOwnCourier` es `false`, debe haber al menos una transportadora habilitada; cuando `delivery` está activo y `shippingPricingMode` es `"fixed"` o `"free_from"`, `flatShippingFee >= 0`; si `shippingPricingMode === "free_from"`, además `freeShippingThreshold >= 1`; si `minimumOrderActive` es `true`, `minimumOrderAmount >= 1`; si `riskThresholdActive` es `true` (con `delivery` y confirmación no manual), `maxShippingCostRisk >= 0`. Con `confirmationMode === "agent"`, `whatsappNumber` es obligatorio y debe tener entre 7 y 15 dígitos.
- **Pagos y políticas (`payments`):** al menos un método de pago activo (`cash_on_delivery`, `bank_transfer`, `payment_link`, `in_store`). Activar `requirePrepaymentBeforePrep` exige tener habilitado al menos un método de pago anticipado (`bank_transfer` o `payment_link`).
- **Tiempos y alertas (`sla`):** `preparationMinutes` y `urgencyThresholdMinutes` en `1..10080`; `confirmationMinutes` en `1..1440` cuando la confirmación no es automática; `dispatchMinutes` en `1..10080` cuando `delivery` está activo; si `outOfHoursAutoReply` está activo, `outOfHoursMessage` es obligatorio (hasta 500 caracteres).
- **Operadores:** opcionales (hasta 50 por negocio). Cada operador requiere nombre (2 a 80 caracteres), correo único en el negocio (normalizado en minúsculas, hasta 254 caracteres), teléfono opcional (7 a 15 dígitos) y al menos una etapa (`confirmation`, `preparation`, `dispatch`). Correo repetido responde `409` con `code: "duplicate-operator-email"` y `fields.email`.
- **Completar (`POST /complete`):** revalida todas las secciones; si falta algún requisito responde `409` con `code: "pedidos-incomplete"` y `fields`. Repetir `complete` sobre una configuración ya lista conserva `readyAt`. Cualquier cambio posterior de contenido vuelve `ready: false` (navegar con `PUT /progress` no invalida `ready`).

### Vista del operador: `GET /pedidos/businesses/:businessId/operator`
```json
{
  "business": { "id": "…", "name": "Casa Oliva" },
  "operator": { "id": "…", "name": "Camila Ruiz", "email": "camila@example.com", "phone": "+573001234567", "stages": ["confirmation", "preparation"] },
  "schedule": { "timezone": "America/Bogota", "inherit": true, "openNow": true },
  "modalities": ["delivery", "pickup"],
  "confirmationMode": "manual"
}
```
El operador se identifica únicamente por el **correo de la sesión**; nunca se exponen otros operadores ni reglas administrativas. Es de solo lectura y, si se retira la asignación, se deshabilita Pedidos o se pausa el negocio, responde `404` en la petición siguiente.

### Integración con login compartido y configuración base (IoC sin ciclos)
- **Login compartido:** `PedidosOperatorAccessSource` se registra en `MemberAccessRegistry` (`business-access/public`) al iniciar el módulo y solo expone operadores con al menos una etapa asignada en negocios activos con `pedidos` habilitado.
- **Estado en `business-setup`:** `PedidosSetupStatusSource` se registra en `ModuleSetupStatusRegistry` (`business-setup/public`) y reporta `{ ready, summary: { modalityCount, operatorCount } }` para que el directorio de módulos muestre el estado real desde el servidor.
- **Puerta pública (`pedidos/public.ts`):** exporta `PedidosModule`, `PEDIDOS_MODULE_ID`, `PEDIDOS_PROFILE_IDS` y `PedidosProfileId`.

### Errores del módulo
`400` validación (`code: "invalid-pedidos-data"` y `fields`) · `401` sin token o sesión terminada (`session-expired`) · `403` token de superadmin o `module-not-enabled` · `404` negocio u operador inaccesible · `409` `duplicate-operator-email`, `pedidos-incomplete`, `concurrent-change`.

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
    │   ├── domain/              Perfil, orígenes permitidos, normalización del teléfono, errores y el puerto del repositorio
    │   └── infrastructure/      Esquemas de Mongo y repositorio de `onboarding_profiles` y `onboarding_intro_views`
    ├── businesses/              Negocios, jefe vigente y módulos habilitados (colección `businesses`)
    ├── business-access/         Acceso de administradores por OTP, sesiones y permisos (`access_challenges`, `access_rate_limits`, `admin_sessions`)
    ├── business-setup/          Configuración inicial del negocio por su administrador (`business_setups`)
    ├── business-dashboard/      Dashboard general del administrador: módulos asignados, su estado real y los indicadores de los que ya operan (sin datos propios)
    ├── turnos/                  Configuración y operación de Turnos: perfil, filas, reglas, operadores y permisos, turnos, tablero, encuestas y tiempo real (`turnos_configurations`, `turnos_tickets`, `turnos_counters`, `turnos_surveys`)
    └── pedidos/                 Configuración de Pedidos: perfil, modalidades, despacho, pagos, SLA y operadores (`pedidos_configurations`)
```

Dentro de un módulo, las capas dependen en una sola dirección: `api` y `infrastructure` -> `application` y `domain`;
`application` -> `domain`; el `domain` no conoce a nadie (solo usa `platform/errors`). El `application` nunca toca Mongoose:
habla con un repositorio abstracto (`domain/*.repository.ts`) que implementa `infrastructure/`.

## Módulos

| Módulo | Responsabilidad | Datos de los que es dueño | Rutas |
|--------|-----------------|---------------------------|-------|
| `auth` | Registro (con código por correo) y login del superadmin; emite la sesión | Colecciones `super_admins` y `pending_registrations` | `/auth/super/*` |
| `onboarding` | Teléfono (único entre usuarios), dónde conoció Necto el usuario y si ya vio la intro | Colecciones `onboarding_profiles` y `onboarding_intro_views` | `/onboarding/profile/*` |
| `businesses` | Negocios, jefe vigente, catálogo y habilitación de módulos | Colección `businesses` | `/businesses/*` |
| `business-access` | Invitación por correo, acceso de administradores con OTP, sesiones y permisos por negocio/módulo | `access_challenges`, `access_rate_limits`, `admin_sessions` | `/business-access/*`, `/businesses/:id/invitation*` |
| `business-setup` | Configuración inicial del negocio por su administrador: datos, logo, horarios (propios o heredados), tipo y progreso | `business_setups` | `/business-setup/businesses/:businessId/*` |
| `business-dashboard` | Dashboard general: módulos asignados, su estado y sus indicadores reales | (ninguno) | `/dashboard/businesses/:businessId` |
| `turnos` | Configuración y operación de Turnos: perfil, filas con campos adicionales, reglas, operadores con vistas y estado; emitir/llamar/atender turnos, tablero, equipo, reporte CSV, pantalla de sala, encuestas y eventos en vivo | `turnos_configurations`, `turnos_tickets`, `turnos_counters`, `turnos_surveys` | `/turnos/businesses/:businessId/{operation,insights,…}`, `/turnos/surveys/:token` |
| `pedidos` | Configuración de Pedidos: perfil operativo, modalidades, logística, pagos/políticas, SLA y operadores (con login compartido y estado en `business-setup`) | `pedidos_configurations` | `/pedidos/businesses/:businessId/*` |

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

- **Casos de uso** de `auth` y `onboarding` con repositorios en memoria y reloj fijo (registro, duplicados, login,
  teléfono normalizado y único entre usuarios, orden de los pasos, paso 2 opcional, texto de «Otro», intro vista, fecha de
  completado).
- **DTOs del onboarding** con `validate()` de class-validator: normalización del teléfono, lista vacía, dos opciones y
  `sourceOther`.
- **Script de migración del teléfono** (`scripts/normalize-onboarding-phones.spec.ts`): plan idempotente, colisiones sin
  fusionar y números ilegibles.
- **Seguridad:** emisión y verificación de tokens (incluido el de administrador de negocio), `AuthenticationGuard` y `SuperAdminGuard`.
- **`businesses`:** creación, idempotencia, validación del catálogo, edición, reemplazo del jefe, pausa y CSV.
- **`business-access`:** códigos por correo (un solo uso, vencimiento, intentos, límites, carrera de dos verificaciones), invitación y
  reenvío, estados de entrega del correo (sin afirmar entrega), inicio de sesión de varios negocios, sesiones (normal, recordada
  hasta 30 días, caducidad, renovación y revocación), reverificación, y los guards de permisos por negocio y módulo.
- **`business-setup`:** permisos (otro administrador, negocio inexistente, pausado o con jefe reemplazado, módulo no asignado, nada se escribe), aislamiento
  entre negocios (incluido un mismo jefe con dos), datos del negocio escritos en el **mismo** negocio del dueño, tipo «Otra», validación de horarios con la ruta de
  cada error, herencia y excepciones de módulos, persistencia al cerrar y volver a abrir sesión, logo (firma real, 1 MB, tipo declarado), progreso y «base preparada»
  (se invalida con cualquier cambio, no con el paso), DTOs y los guards declarados en los controladores. Con `NECTO_TEST_MONGODB_URI` apuntando a la base de desarrollo,
  `mongo-business-setup.repository.spec.ts` también prueba el repositorio contra MongoDB real (usa ids propios y los borra al terminar):
  `NECTO_TEST_MONGODB_URI="$(grep ^MONGODB_URI= .env | cut -d= -f2-)" npm test`.
- **Login compartido** (`business-access/application/access-grants.service.spec.ts`, `turnos/shared-login.spec.ts`, `pedidos/shared-login.spec.ts`): una identidad con varios roles
  (jefe de un negocio y operadora de otro, o ambos en el mismo, e incluso operadora simultánea de Turnos y Pedidos), el flujo OTP real de un operador (código por correo, un solo uso, bloqueo por intentos, el
  código de demostración `123456` no abre nada), el guard de operador (otro negocio, otro módulo, un jefe que no es operador) y cómo se cierra el acceso
  al retirar la asignación, deshabilitar el módulo, pausar el negocio o reemplazar al jefe, sin borrar la identidad ni los demás accesos.
- **`turnos`:** reglas y herencia campo por campo (incluida la combinación de límites heredados y propios), validación de filas y operadores, perfil
  (reemplazar sugerencias sin tocar, conservar y no duplicar), eliminación con reasignación, aislamiento entre negocios (ids de otro negocio, mismo correo en
  dos negocios), persistencia al volver a abrir, concurrencia (reintento y conflicto), «guardar» (mínimo, fecha conservada, se invalida con cualquier cambio),
  vista del operador (solo sus filas), contrato con la configuración base, DTOs, guards declarados en los controladores y la forma de las respuestas.
  `mongo-turnos-configuration.repository.spec.ts` prueba el repositorio contra MongoDB real con `NECTO_TEST_MONGODB_URI` (versión, dos escritores, borrar fila y
  reasignar en una escritura, búsqueda por correo de operador).
- **`pedidos`:** inicialización única por perfil sugerido, validación de dominio por sección (modalidades, logística/transportadoras/flete, pagos/políticas, SLA/fuera de horario, operadores por etapa y unicidad de correo), cambio de perfil conservando operadores, progreso sin invalidar `ready`, concurrencia optimista, `complete` con `pedidos-incomplete`, vista acotada del operador, fuentes IoC (`PedidosOperatorAccessSource` y `PedidosSetupStatusSource`), DTOs con whitelist estricto y guards declarados en los controladores. 
- **Operación de Turnos** (`turnos/**/*.spec.ts`, `business-dashboard/*.spec.ts`): permisos de cada rol, vista y fila (operador pendiente, apagado, sin vistas o sin filas; otra fila, otro negocio, el administrador que no opera) y que **un cambio de permisos
  llega a la sesión abierta** (`operation-login.spec.ts`, `turnos-access.service.spec.ts`); creación y numeración (prefijos propios y heredados, reinicio diario a medianoche **en la zona del negocio**, códigos compartidos, `clientRequestId`, 40 creaciones simultáneas sin repetir códigos);
  campos adicionales por fila (obligatorios, tipos, opciones); flujo **manual y automático** (siguiente por orden de llegada al completar, un turno por operador, llamadas y completados repetidos o simultáneos); pausa; búsqueda, filtros y paginación; tablero, equipo, actividad, CSV
  (incluida la protección contra fórmulas) y pantalla de sala; encuestas (invitación única por turno, correo aceptado / no configurado / fallido, WhatsApp siempre no configurado, una sola respuesta, vencimiento, cálculos y permisos); flujo en vivo (filtrado por fila y vista,
  revocación y cambio de permisos con la conexión abierta, aislamiento entre negocios); contrato de los controladores (guards y vista de cada ruta); dashboard general (`entry`, módulos sin configuración que no bloquean, indicadores solo reales).
  `mongo-ticket.repository.spec.ts` prueba contra MongoDB real (con `NECTO_TEST_MONGODB_URI`) lo que solo la base demuestra: 100 numeraciones simultáneas sin huecos ni repetidos, diez operadores llamando al mismo turno, diez tomando «el siguiente», un operador llamando dos turnos a la vez
  (índice único parcial), completar seis veces a la vez, una sola respuesta de encuesta entre varias, búsqueda sin interpretar patrones y lectura de configuraciones guardadas antes de las vistas.
  Suite total del backend: **650 pruebas** con `npm run test:api` (más las de MongoDB real con `NECTO_TEST_MONGODB_URI`).
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
