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
- **Pausar / reanudar.** Un negocio pausado deja de aparecer para su administrador y bloquea sus módulos (no recibe códigos de acceso).
- **Ficha.** Resumen, módulos y equipo; `summary.hasActivity` es `false` (no se inventan métricas). Nunca expone códigos,
  hashes ni secretos.
- **Puerta pública** (`public.ts`): `BusinessDirectory` (consulta de un negocio y su jefe vigente), el evento `BossAssigned`
  y `BusinessModuleAccess` (para que un módulo futuro compruebe en el servidor si un módulo está habilitado).

Datos: colección `businesses`, índices `{ ownerId, idempotencyKey }` (único), `{ ownerId, createdAt }` y
`{ ownerId, status, category }`.

## Módulo business-access

Acceso de los **administradores de negocio** (el jefe asignado de cada negocio), **sin contraseña**: el correo asignado y un código
de 6 dígitos enviado a ese correo. Una misma persona puede administrar varios negocios; entra una vez y elige.

### Cómo funciona

1. `POST /business-access/otp/request { email }` → `202` (`expiresInMinutes`, `resendAfterSeconds`, `maxAttempts`) si el correo es el jefe
   vigente de algún negocio **activo**: se pide el envío del código. Si no lo es (sin negocio, negocio pausado o jefe reemplazado),
   responde `404` con `code: "email-not-assigned"` y **no se crea ningún código**: la pantalla no avanza y dice que primero el
   superadministrador debe invitar a la persona. Pedir otro código antes de 60 s, o mientras espera un código temporal, responde `202` sin
   emitir uno nuevo.
   > **Decisión de producto:** esta respuesta revela si un correo está asignado a un negocio (antes el acceso respondía igual para
   > todos). Cada solicitud, asignada o no, cuenta para los límites por correo y por IP (5/h y 20/h), que es lo que frena el sondeo
   > masivo. Si algún día debe volver la respuesta genérica, el único cambio es dejar de lanzar `EmailNotAssignedError` en
   > `AdminLoginService.requestCode`.
2. `POST /business-access/otp/verify { email, code, remember? }` → `200`. El servidor gasta el código, comprueba que el correo siga siendo
   jefe de al menos un negocio activo y abre una **sesión de servidor**. Responde con `accessToken` (corto), `expiresInSeconds`,
   `admin { email, remember }` y `businesses[]` (solo los autorizados), y pone la cookie de sesión.
3. Con una sola opción el cliente entra directo; con varias muestra el selector. Cada negocio se confirma con
   `GET /business-access/businesses/:businessId` (el servidor vuelve a comprobar todo).

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
- El `accessToken` (JWT, `role: business-admin`, solo lleva el id de la sesión) dura **10 minutos** y se pide de nuevo con
  `POST /session/refresh` usando la cookie. El cliente lo guarda **solo en memoria**.
- **Sesión normal:** cookie de navegador (muere al cerrarlo), 2 h de inactividad y 12 h en total.
- **"Recordar este dispositivo"** (`remember: true`, **desactivado por defecto**): cookie de 30 días como máximo, 14 días de inactividad,
  nunca más de **30 días desde el código** aunque se renueve (`ADMIN_REMEMBER_DAYS` no puede pasar de 30).
- **Renovación:** `refresh` mueve la caducidad por inactividad, nunca más allá de la absoluta, y devuelve los negocios autorizados en ese
  instante. Si ya no administra ninguno, la sesión se termina.
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
  decoradores de `business-access/public.ts`: `@BusinessAdminOnly()`, `@RecentlyVerified()` y `@RequiresBusinessModule('reservas')`.

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
    └── business-access/         Acceso de administradores por OTP, sesiones y permisos (`access_challenges`, `access_rate_limits`, `admin_sessions`)
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
| `business-access` | Invitación por correo, acceso de administradores con OTP, sesiones y permisos por negocio/módulo | `access_challenges`, `access_rate_limits`, `admin_sessions` | `/business-access/*`, `/businesses/:id/invitation*` |

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
- **Seguridad:** emisión y verificación de tokens (incluido el de administrador de negocio), `AuthenticationGuard` y `SuperAdminGuard`.
- **`businesses`:** creación, idempotencia, validación del catálogo, edición, reemplazo del jefe, pausa y CSV.
- **`business-access`:** códigos por correo (un solo uso, vencimiento, intentos, límites, carrera de dos verificaciones), invitación y
  reenvío, estados de entrega del correo (sin afirmar entrega), inicio de sesión de varios negocios, sesiones (normal, recordada
  hasta 30 días, caducidad, renovación y revocación), reverificación, y los guards de permisos por negocio y módulo.
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
