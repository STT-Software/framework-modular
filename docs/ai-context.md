# Contexto para IA: léelo primero

> **Este es el documento más importante del repo para cualquier IA que trabaje aquí**
> (Kiro, Claude, Copilot, Codex u otra). Está pensado para retomar el trabajo en una
> sesión nueva, sin el historial de la anterior. Léelo completo antes de tocar nada.
>
> **Es una foto, no la verdad absoluta.** Se actualizó el **2026-11-13**, con `integration`
> en `fb5a075` más la rama `feature/welcome-onboarding` (onboarding con su servicio). Si algo de aquí contradice el código, manda el código: verifica con
> `git log`, `git status` y leyendo los archivos. Y **actualízalo** cuando cambie el
> estado del proyecto (ver la última sección).

## Índice

1. [Cómo trabajar con este equipo (reglas)](#1-cómo-trabajar-con-este-equipo-reglas)
2. [Qué es el proyecto](#2-qué-es-el-proyecto)
3. [Estado actual](#3-estado-actual)
4. [Mapa del repo](#4-mapa-del-repo)
5. [Stack, lenguajes y versiones](#5-stack-lenguajes-y-versiones)
6. [Arquitectura en resumen](#6-arquitectura-en-resumen)
7. [Flujo de ramas y PRs](#7-flujo-de-ramas-y-prs)
8. [Levantar y verificar todo (runbook)](#8-levantar-y-verificar-todo-runbook)
9. [Contrato de los servicios](#9-contrato-de-los-servicios)
10. [Frontend: patrones y diseño](#10-frontend-patrones-y-diseño)
11. [Carpetas y repos de referencia](#11-carpetas-y-repos-de-referencia)
12. [Herramientas del entorno y trampas conocidas](#12-herramientas-del-entorno-y-trampas-conocidas)
13. [Decisiones tomadas, pendientes y diferidas](#13-decisiones-tomadas-pendientes-y-diferidas)
14. [Cómo retomar el trabajo](#14-cómo-retomar-el-trabajo)
15. [Mantener este documento](#15-mantener-este-documento)

---

## 1. Cómo trabajar con este equipo (reglas)

Reglas que el equipo pidió de forma explícita. Respétalas siempre.

**Idioma**
- Habla con la persona en **español**.
- **Todo el código en inglés**: nombres de módulos, carpetas, archivos, variables, campos de la
  API, mensajes de error y comentarios.
- Los textos que ve el usuario final (interfaz) y la **documentación** del repo van en **español**.

**Git y entrega**
- **No hagas commit, push ni abras PR si no te lo piden.** Cuando te lo pidan, hazlo completo.
- Ramas **end to end**: backend, frontend y documentación van juntos en la misma rama y el mismo PR
  (detalle en [`flujo-de-ramas.md`](flujo-de-ramas.md)).
- **No crees ramas nuevas por tu cuenta.** Trabaja en la que la persona indique.
- Los PRs van siempre hacia `integration`. Nunca empujes a `main`, `test` ni `production`.
- Nombres de rama en minúsculas con guiones (`feature/super-login`). Prefijos en
  [`flujo-de-ramas.md`](flujo-de-ramas.md). No existe el prefijo `test/`.
- Antes de hacer commit revisa que no entren secretos, `.env`, `node_modules`, `dist` ni
  `referencias html/`.

**Arquitectura**
- **Modular "screaming"**: un módulo de negocio = un servicio independiente + un módulo de frontend
  en `src/modules/`. Ver [`arquitectura.md`](arquitectura.md).
- **No se usa lint** de límites entre módulos. Un módulo **puede importar a otro** si hace falta,
  solo por su puerta pública (`index.ts`) y declarándolo en su README.
- La UI se construye con **Elements** (catálogo de WebIAI). Mantén el diseño, los logotipos y las
  animaciones de las referencias.

**Forma de trabajar**
- **Verifica antes de afirmar.** Prueba en el navegador y contra los servicios reales. Di qué
  probaste y qué no pudiste probar.
- **Responde exactamente lo que se preguntó.** Si la persona hace una pregunta de sí/no
  ("¿ya está conectado al backend?"), contesta eso primero y corto; no la entierres en pendientes.
- Reporta con honestidad los errores propios y los hallazgos incómodos (por ejemplo, datos perdidos).
- Limpia los datos de prueba que crees, y **nunca borres datos que no sean tuyos**.
- No inventes lo que falta: si algo no está definido (por ejemplo, el criterio de un módulo futuro),
  pregunta.

## 2. Qué es el proyecto

**NECTO** es una plataforma SaaS para negocios. Este repo, **`framework-modular`**
(`STT-Software/framework-modular`), es la **base común** donde se están centralizando los módulos
de todo el equipo para trabajar sobre un mismo proyecto con flujo de PRs.

Origen: antes el trabajo estaba repartido en dos repos independientes (ver
[sección 11](#11-carpetas-y-repos-de-referencia)):

| Repo | De quién | Módulos |
|------|----------|---------|
| `Repo-prueba` (`STT-Necto-Turnos-Agendamiento`) | La persona con la que se trabaja en esta sesión | **Turnos** y **Agendamiento** (frontend en gran parte *mock*) |
| `necto_reservas_y_referidos` | Un compañero | **Reservas** y **Referidos** |

La idea es traer todo a `framework-modular` con la arquitectura nueva (modular, un servicio por
módulo). **Hoy solo está construido el acceso del SuperAdmin y su bienvenida con perfil (onboarding: teléfono y dónde nos conoció).**

**Actores del producto (según lo hablado):**
- **SuperAdmin**: administra toda la plataforma. Inicia sesión con usuario o correo + contraseña.
  En el futuro solo existirá si compra la suscripción de Necto (no se trabaja todavía).
- **Admin de un negocio**: tendrá su **propio login**, distinto al del SuperAdmin. Todavía no está
  construido. En `Repo-prueba` existe una versión *mock* con código OTP; es solo referencia.

## 3. Estado actual

### Construido y en `integration`

| Pieza | Dónde | Estado |
|-------|-------|--------|
| Servicio de login/registro del SuperAdmin | `packages/services/super-admin-auth` | Funciona, probado con MongoDB real |
| MongoDB de desarrollo (Docker) | `infra/` | Funciona; una base y un usuario por servicio |
| Pantallas `/super/login` y `/super/register` | `packages/apps/web/modules/app/src/modules/super-admin-auth` | Funcionan, conectadas al servicio |
| Cerrar sesión | `src/app/SignOutButton.tsx` | Funciona (borra la sesión del navegador) |
| Servicio del perfil de bienvenida | `packages/services/onboarding` (puerto 8081, base `onboarding`) | Funciona, probado con MongoDB real: guarda teléfono (único entre usuarios) y dónde nos conoció, por id de usuario |
| Onboarding (bienvenida + perfil) | `src/modules/onboarding` (README propio) | Funciona: `/welcome` (animación, sin Omitir ni Pausar) → *Comenzar* → `/welcome/phone` → `/welcome/source` → `/`. Con el perfil ya completo, solo se ve la primera escena y entra a `/` |
| Puerta de acceso | `src/app/RequireSuperAdmin.tsx` | Sin sesión, `/` y URLs desconocidas llevan a `/super/login`. Los módulos con `requiresSuperAdmin: true` (el onboarding) quedan detrás de ella |
| Registro de módulos + aislamiento de fallos | `src/app/modules.ts`, `ModuleRoutes.tsx`, `ModuleBoundary.tsx` | Funciona |
| CI de promoción de ramas | `.github/workflows/` | Existe; `production` aún no se ha promovido nunca |

El registro pide: usuario, contraseña + confirmación, correo, tipo y número de documento
(`CC`, `CE`, `PA`, `NIT`) y aceptación de términos.

### Lo que NO existe (no lo des por hecho)

- Login del **admin de un negocio**.
- Los módulos **Turnos, Agendamiento, Reservas y Referidos** no están portados a este repo.
- La **vista de términos y condiciones** (el enlace del registro no navega: `TERMS_PATH` está vacío
  en `components/TermsCheckbox.tsx`).
- **Validación de la sesión contra el servidor**: la puerta de acceso solo mira que haya un token
  guardado y no vencido. No hay todavía rutas protegidas que lo exijan al servidor.
- **Endpoint de logout**: el JWT no tiene estado; cerrar sesión solo lo borra del navegador.
- **Pruebas automáticas**: no hay tests escritos. Todo se ha verificado a mano y con `tsc`/build.
- Bundle de **WebIAI** para el servicio (ver sección 12).

### Entorno en el momento de escribir esto

- El PR #3 (login y registro del SuperAdmin) está **mezclado** en `integration`.
- Al final de la sesión anterior **el entorno Docker se reinició y se perdieron los datos de
  MongoDB** (volumen e imagen). Los archivos `.env` y `node_modules` sí se conservaron, porque viven en
  `/workspaces`. La cuenta `oscarprueba` que la persona había creado **ya no existe**: hay que
  volver a registrarla.
- Se verificó un **arranque en frío completo** (sección 8): Mongo, servicio y web funcionan.
- El volumen de Mongo de la sesión del onboarding ya existía cuando se creó el servicio `onboarding`, así que su
  usuario de base de datos se creó **a mano** (`mongo-init` solo corre al crear el volumen; ver el README del servicio).

## 4. Mapa del repo

```
framework-modular/
├── AGENTS.md                      Puntero para IAs: remite a este documento
├── README.md                      Entrada del repo (arriba remite a este documento)
├── .kiro/steering/ai-context.md   Reglas siempre activas para Kiro (remite a este documento)
├── .github/workflows/             promover-a-main-y-test.yml, promover-a-production.yml
├── docs/
│   ├── ai-context.md              ESTE documento
│   ├── arquitectura.md            Arquitectura modular "screaming"
│   └── flujo-de-ramas.md          Ramas, nomenclatura, PRs, promociones, protección
├── infra/                         MongoDB de desarrollo
│   ├── docker-compose.yml         Contenedor `framework-modular-mongo` (mongo:8)
│   ├── mongo-init/                Crea una base y un usuario por servicio (solo en el primer arranque)
│   └── .env(.example)             Contraseñas de Mongo (`.env` no se versiona)
├── referencias html/              (NO versionada) diseños de referencia: necto-superlogin.html
├── package.json                   Scripts de la raíz
├── webiai.config.mjs, lerna.json, tsconfig.json   Esqueleto WebIAI (el CLI no se pudo instalar)
└── packages/
    ├── services/
    │   ├── super-admin-auth/      Servicio NestJS + MongoDB, puerto 8080 (README con el contrato)
    │   │   └── src/{main.ts, app.module.ts, config/, health.controller.ts, auth/, super-admin/}
    │   └── onboarding/            Servicio NestJS + MongoDB, puerto 8081: teléfono y origen del usuario
    │       └── src/{main.ts, app.module.ts, config/, health.controller.ts, auth/, profile/}
    └── apps/web/modules/app/      App React + Vite + Tailwind
        ├── .kiro/skills/webiai-elements/SKILL.md   Guía del MCP de Elements
        └── src/
            ├── app/               App, shell, sidebar, registro de módulos, puerta de acceso, ModuleBoundary
            ├── modules/super-admin-auth/   Primer módulo (README propio)
            ├── modules/onboarding/         Bienvenida + pasos de perfil (teléfono, dónde nos conoció) (README propio)
            ├── elements/          Componentes de Elements instalados (no se modifican)
            ├── css/theme.css      Tema y tokens (incluye los colores `necto-*`)
            ├── shell/ layouts/ icons/ hooks/ utils/ stores/   Base común del scaffolding
            └── pages/WelcomePage.tsx   Página de bienvenida del scaffolding (destino tras pulsar *Comenzar* en la bienvenida)
```

**Elements instalados hoy** (`src/elements/`): `Button`, `Input`, `Label`, `Alert`, `Select`,
`Checkbox`, `Card` (+ partes) y `Breadcrumb`. Si necesitas otro, pídelo al catálogo (sección 10).

## 5. Stack, lenguajes y versiones

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Runtime | Node.js / npm | 22.x / 10.x |
| Frontend | React / React Router | 18.3 / 7.1 |
| | Vite / Tailwind CSS | 6.x / 4.0.15 |
| | MobX / mobx-react-lite | 6.15 / 4.1 |
| | TypeScript | 5.7 |
| | Fuente | DM Sans (`@fontsource/dm-sans` 5.3.0) |
| Backend | NestJS (core, jwt, mongoose, config, throttler) | 12.5 / 12.0 / 12.0 / 12.1 / 6.7 |
| | TypeScript | **6.0.3** (NestJS 12 lo exige) |
| | Mongoose / MongoDB | 9.12 / **8** (imagen `mongo:8`) |
| | bcryptjs · class-validator · class-transformer | 3.0 · 0.15 · 0.5 |
| Infra local | Docker / Docker Compose | 29.x / v5 |
| CI/CD | GitHub Actions, `gh` CLI | gh 2.97 |
| Otros | WebIAI CLI (`webiai`) | 0.23.11, instalado global pero **no operativo aquí** |

- Las dependencias se instalan **con versión exacta** (`--save-exact`) en el servicio.
- El frontend usa los rangos del scaffolding de Elements.
- Lenguajes: **TypeScript** (todo el código), **CSS** (Tailwind + CSS propio), **Markdown** (docs),
  **YAML** (workflows y Docker), **Shell** (script de `mongo-init`). Los scripts auxiliares de edición
  que se usaron en sesiones (Python/Node) no forman parte del repo.

## 6. Arquitectura en resumen

Detalle completo en [`arquitectura.md`](arquitectura.md). Lo esencial:

- **Un módulo = un servicio** (proceso, puerto, base y `.env` propios) **+ un módulo de frontend**.
- Cada servicio tiene su base de datos y **su usuario de Mongo, limitado a esa base**.
- El frontend es una sola app. Cada módulo vive en `src/modules/<modulo>/`, expone su
  definición por `index.ts` (rutas) y se registra en `src/app/modules.ts`.
- Las rutas de cada módulo van con `React.lazy` y dentro de un `ModuleBoundary`: si un módulo falla
  al cargar o al renderizar, se contiene y el resto de la app sigue funcionando.
- El navegador llama a `/api/super-admin-auth/...` y `/api/onboarding/...`; el **proxy del dev server de Vite** los
  reenvía a cada servicio (`SUPER_ADMIN_AUTH_URL`, por defecto `http://localhost:8080`; `ONBOARDING_URL`, por defecto
  `http://localhost:8081`). Fuera de desarrollo hay que definir `VITE_SUPER_ADMIN_AUTH_API_URL`,
  `VITE_ONBOARDING_API_URL` y `CORS_ORIGIN` en cada servicio.
- Límites conocidos (más detalle en `arquitectura.md`): el JWT se firma con secreto compartido (HS256) y
  **ya hay un segundo servicio** (`onboarding`) que lo valida con el mismo `JWT_SECRET`: la firma asimétrica sigue
  pendiente y es la deuda técnica más clara. Una sola instancia de Mongo sirve a
  todos en desarrollo.

## 7. Flujo de ramas y PRs

Detalle en [`flujo-de-ramas.md`](flujo-de-ramas.md). Resumen:

```
rama de trabajo (sale de integration) → PR → integration → main → test → production
                                                   auto        auto     manual
```

- `integration` es la rama por defecto. Todas las ramas salen de ella y los PRs llegan a ella.
- Al mezclar en `integration`, el workflow **`promover-a-main-y-test`** avanza `main` y `test` al
  mismo commit (fast-forward, sin force).
- `test → production` es **manual**: Actions → *Promover test -> production* → escribir `PRODUCCION`.
- Solo se permite **squash merge**. La rama se borra al mezclar.

**Protección (rulesets de GitHub)**
- `integration-solo-por-pr`: PR obligatorio con **1 aprobación**, conversaciones resueltas, sin force
  push ni borrado. Los **administradores** pueden mezclar sin esperar aprobación (`bypass` solo vía PR).
- `main-test-production-historial-protegido`: sin force push, sin borrado, historial lineal.
  Limitación: **no bloquea pushes directos**, porque el token de Actions no puede ir en la lista de
  excepciones. No empujes ahí.

**Comandos habituales**
```bash
gh pr create --base integration --head <rama> --title "..." --body-file <archivo>
gh pr view <n> --repo STT-Software/framework-modular --json state,mergeStateStatus
gh pr merge <n> --squash --admin        # solo si el compañero no está y la persona lo pide
```

## 8. Levantar y verificar todo (runbook)

Todo desde la raíz del repo (`/workspaces/framework-modular`). Requiere Node 22 y Docker.

**Primera vez en una máquina** (los `.env` no se versionan):
```bash
cp infra/.env.example infra/.env                              # completar 3 contraseñas
cp packages/services/super-admin-auth/.env.example packages/services/super-admin-auth/.env
cp packages/services/onboarding/.env.example packages/services/onboarding/.env   # mismo JWT_SECRET que super-admin-auth
openssl rand -hex 16     # cada contraseña de infra/.env
openssl rand -hex 48     # JWT_SECRET (mínimo 32 caracteres)
npm install --prefix packages/services/super-admin-auth
npm install --prefix packages/services/onboarding
npm install --prefix packages/apps/web/modules/app
```
La contraseña de `MONGODB_URI` de cada servicio debe ser igual a su variable en `infra/.env`
(`SUPER_ADMIN_AUTH_DB_PASSWORD`, `ONBOARDING_DB_PASSWORD`). El `JWT_SECRET` de `onboarding` debe ser **idéntico**
al de `super-admin-auth`: si no, el onboarding rechaza todos los tokens con `401`.

**Arranque (4 procesos)**
```bash
npm run db:up                  # MongoDB en 127.0.0.1:27017 (espera a que esté "healthy")
npm run dev:super-admin-auth   # servicio en http://localhost:8080
npm run dev:onboarding         # servicio en http://localhost:8081
npm run dev                    # app web en http://localhost:6020
```
- **Si eres una IA con herramienta de procesos en segundo plano**, lanza los tres `npm run dev...`
  con esa herramienta (en Kiro: `control_bash_process`, que hay que cargar antes con `tool_load`).
  Si los pones en el comando normal del shell, la herramienta avisa y **no los ejecuta**.
- Si `infra/.env` y los datos de Mongo no coinciden (por ejemplo, perdiste el `.env`), la base no
  acepta las contraseñas: borra el volumen con `docker compose -f infra/docker-compose.yml down -v` y
  vuelve a levantar. **Esto borra los datos.**
- Si tu volumen de Mongo es anterior al servicio `onboarding`, su usuario no existe (el init solo corre al crear el
  volumen): créalo a mano con el comando del README del servicio, sin borrar datos.
- Un servicio en segundo plano puede **salir solo sin error en el log**: antes de probar, comprueba `/health` de cada uno.

**Verificación rápida**
```bash
curl http://localhost:8080/health                              # servicio directo
curl http://localhost:6020/api/super-admin-auth/health         # a través del proxy de Vite
curl http://localhost:8081/health                              # servicio onboarding
curl http://localhost:6020/api/onboarding/health               # onboarding a través del proxy (reinicia Vite si cambias vite.config.ts)
```
Pantallas: `http://localhost:6020/super/login` y `/super/register`; tras iniciar sesión, `/welcome`,
`/welcome/phone` y `/welcome/source`. Al abrir `/` sin sesión te manda
al login. Sesión y datos: ver trampas en la sección 12.

**Comprobaciones antes de entregar**
```bash
npm run typecheck             # frontend
npm run build                 # frontend (tsc -b && vite build)
npm run build:super-admin-auth
npm run build:onboarding
```

**Limpiar datos de prueba** (borra solo por nombre de usuario, nunca todo):
```bash
PW=$(grep '^MONGO_ROOT_PASSWORD=' infra/.env | cut -d= -f2-)
docker exec framework-modular-mongo mongosh --quiet -u root -p "$PW" --authenticationDatabase admin \
  super_admin_auth --eval 'db.super_admins.deleteMany({username:"mi.cuenta.de.prueba"})'
```
El perfil de esa cuenta vive en **otra base** (`onboarding`, colección `onboarding_profiles`, campo `userId` = `_id` de
la cuenta): bórralo también, buscando primero el id de tu cuenta de prueba. El teléfono es único, así que un perfil
de prueba olvidado bloquea ese número.

**Limitaciones al probar**
- `register` y `login` aceptan **5 peticiones por minuto por IP**; la sexta da `429`. Espacia las pruebas.
- `PUT /onboarding/profile/phone` acepta **10 por minuto por IP** (cuentan también las que dan `400`).
- Si tu Mongo viene de una versión anterior del esquema, hay que borrar el índice
  `identityDocument_1` (el actual es compuesto: tipo + número).

## 9. Contrato de los servicios

### super-admin-auth (puerto 8080)

Contrato completo y vigente en
[`packages/services/super-admin-auth/README.md`](../packages/services/super-admin-auth/README.md).
Resumen:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/auth/super/register` | Crea un SuperAdmin. |
| `POST` | `/auth/super/login` | Login con usuario **o** correo. Devuelve `{ accessToken, superAdmin }`. |
| `GET` | `/auth/super/me` | Perfil del autenticado (`Authorization: Bearer <token>`). |
| `GET` | `/health` | Estado. |

Registro: `username`, `email`, `password`, `identityDocumentType` (`CC`/`CE`/`PA`/`NIT`),
`identityDocument`, `acceptTerms` (debe ser `true`). Login: `identifier`, `password`.

- Contraseñas con **bcrypt**. JWT con `sub` y `role: "superadmin"`, vence en 1 h (`JWT_EXPIRES_IN`).
- Únicos: `username` y `email`; el documento es único **junto con su tipo**.
- Usuario inexistente y contraseña incorrecta dan el mismo `401 Invalid credentials` y tardan lo mismo.
- Cualquier campo fuera de la lista se rechaza con `400`.
- Colección Mongo: `super_admins`, en la base `super_admin_auth`.

### onboarding (puerto 8081)

Contrato completo y vigente en
[`packages/services/onboarding/README.md`](../packages/services/onboarding/README.md). Resumen:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/onboarding/profile/me` | Perfil de quien tiene el token: `{ phone, sources, completed }` (vacío si no hay). |
| `PUT` | `/onboarding/profile/phone` | Paso 1. Cuerpo `{ phone }` en E.164 (`+573001234567`). `409` si otra cuenta ya lo usa. |
| `PUT` | `/onboarding/profile/sources` | Paso 2. Cuerpo `{ sources: [...] }` con `instagram`, `tiktok`, `facebook`, `youtube`, `whatsapp`, `linkedin`, `family`, `business`, `other`. Marca el perfil como completo. `409` si aún no hay teléfono. |
| `GET` | `/health` | Estado. |

- Exige el JWT de `super-admin-auth` (mismo `JWT_SECRET`, HS256, rol `superadmin`). El id del usuario sale del `sub`
  del token, nunca del cuerpo. Valida el token localmente: no llama a `super-admin-auth`.
- Colección Mongo `onboarding_profiles` en la base `onboarding`; `userId` y `phone` son **únicos** (índices).

## 10. Frontend: patrones y diseño

**Diseño de referencia:** `referencias html/necto-superlogin.html` (sección 11) y diseño NECTO en StockFlow. Dos columnas:
formulario a la izquierda y panel de marca a la derecha con fondo interactivo de puntos (`InteractiveDotGrid`),
aros decorativos (`DecorativeCircles`) y mensajes rotativos con transición escalonada (`RotatingBrandMessages`).
Tema **claro** (panel naranja `#ff3f1a`) y **oscuro** (panel azul profundo `#190088`). Fuente **DM Sans** (300, 400, 700).

**Tokens de marca** (en `src/css/theme.css`): `necto` / `secondary-600` `#190088`, `necto-hover` `#17016c`,
`necto-dark` / `brand-500` / `necto-accent` `#ff3f1a`, `necto-dark-hover` / `brand-600` `#e5351a`,
`necto-link` / `accent-300` `#97d6df`, `gray-100` `#ececec`, `ink-body` `#212121`, `cream` `#efe6d3`.

**Cómo está hecho el módulo** (`src/modules/super-admin-auth`, README propio):
`SuperAdminAuthLayout` (layout compartido, el panel de marca no se reinicia al cambiar de pantalla),
`pages/`, `components/`, `api/` (cliente HTTP con timeout y errores tipados), `stores/` (sesión MobX en
`sessionStorage`, clave `super-admin-auth:session`), `validation.ts` (espejo de las reglas del backend),
`styles/auth-layout.css` (clases con prefijo `sa-`).

**Reglas de trabajo con Elements**
- **No modifiques** los archivos de `src/elements/`. El acabado propio se aplica con `className`
  desde el módulo.
- El tema oscuro usa la clase `.dark` en `<html>`, gestionada por `uiStore` (clave
  `webforge-ui-preferences` en `localStorage`). El tema por defecto es **claro**.
- `Checkbox` solo acepta texto en `label`; para meter un enlace se compone con una etiqueta externa
  (ver `TermsCheckbox.tsx`).
- Los textos de la interfaz van en español; los mensajes del servicio se traducen a un aviso entendible.

**Cómo pedir un componente nuevo a Elements** (herramientas MCP `webiai-elements::*`, hay que cargarlas con
`tool_load` antes de usarlas):
1. `ui_lookup` para confirmar el nombre exacto y las variaciones.
2. `ui_implement` con `select` y luego `commit: true`, pasando `project_src_files` (lista de archivos
   existentes) para detectar solapamientos.
3. Descargar el `.tar.gz` de la URL que devuelve (**caduca en 30 minutos**) y extraerlo en `src/`.
4. Verificar los hashes MD5 del manifiesto y correr `tsc --noEmit`.
5. Si un archivo existente difiere del paquete, **no lo sobrescribas**.

## 11. Carpetas y repos de referencia

Son **solo para consultar**. No se versionan en este repo.

| Ubicación | Qué es | Cómo usarla |
|-----------|--------|-------------|
| `/workspaces/framework-modular/referencias html/` | Diseños HTML de referencia. Hoy: `necto-superlogin.html` (login + registro), `necto-onboardingBienvenida.html` (animación de bienvenida), `necto-telefono.html` y `necto-origen` (este último **sin extensión**; los dos son el mismo documento con otra vista inicial: pasos de teléfono y origen). Está en `.gitignore`: solo existe en la máquina de quien la tiene. | Fuente de verdad del **diseño** del login/registro. Para ver su CSS propio, extráelo del `<style>` (trae fuentes en base64 que conviene saltarse). Ábrelo en el navegador para comparar. |
| `/workspaces/Repo-prueba` | Repo de la persona: **Turnos** y **Agendamiento**. Remoto `STT-Software/STT-Necto-Turnos-Agendamiento`, rama `master`. Backend Express + Bun + DynamoDB con el SDK de WebIAI; frontend React con stores *mock* (localStorage). Tiene también un SuperAdmin/negocios/OTP *mock* y el backend de Referidos ya portado (`ReferidosDAO`) con su dominio de frontend, **sin pantallas de referidos**. | Referencia de **qué hacen** Turnos y Agendamiento. Docs útiles en `docs/`: `flujo-modulo-turnos.md`, `flujo-modulo-agendamiento.md`, `flujo-superadmin.md`, `correr-local.md`, `arquitectura-infraestructura.md`. **Su arquitectura es distinta** (WebIAI/DynamoDB); no la copies, tradúcela a la de este repo. |
| `/workspaces/_necto_referidos_src` | Clon superficial (`--depth 1`) y **solo lectura** de `STT-Software/necto_reservas_y_referidos` (rama `main`), repo del compañero: **Reservas** y **Referidos**. Backend: Lambda única con DynamoDB y JWT de Cognito. | Documentación de producto en `Docs/`: `Modulo-Referidos.md`, `Modulo-Reservas.md`, `Producto-Necto-MVP.md`. Referidos: backend en `packages/services/core/src/referrals/`, frontend en `packages/web/app/src/{domain,pages}/referrals/`. **No lo modifiques.** |

Acceso a repos privados: `gh repo clone STT-Software/<repo>` (usa el token de `gh`). `git clone` a
secas falla por autenticación.

Si una carpeta de referencia no existe en tu sesión (porque cambió el entorno), pídesela a la persona
o vuelve a clonarla; no inventes su contenido.

## 12. Herramientas del entorno y trampas conocidas

**Git y GitHub**
- No hay `git config` de usuario: la identidad sale de variables de entorno (`GIT_AUTHOR_NAME`,
  `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`). Los commits funcionan sin configurar nada. No toques la config.
- Para `fetch`/`push` usa el helper de `gh` solo en ese comando:
  `git -c credential.helper= -c credential.helper='!gh auth git-credential' push -u origin <rama>`.
- El token de `gh` tiene alcance `repo` y `workflow`, **sin `read:org`**: algunas consultas fallan
  (por ejemplo `gh pr view --json reviewRequests`). Pide solo los campos que necesitas.
- Los mensajes de commit y PR se han escrito en español.

**WebIAI**
- El registro `npm.pkg.webiai.io` devolvía **500 `bug in the auth plugin system`** para todos los
  paquetes (comprobado también el 2026-11-12, mismas dos IPs). Por eso `webiai install` no se completa y
  este repo **no tiene los bundles** de WebIAI (`srv.api`, `cloud.core`). Es un fallo del servidor, no
  de la red ni del token. Reintenta de vez en cuando; cuando vuelva, ejecuta `webiai install` en la raíz.

**Navegador para pruebas (Chrome headless)**
- Binario: `/workspaces/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome`.
- Lánzalo como proceso en segundo plano:
  `chrome --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-port=9223 --user-data-dir=/tmp/<perfil> about:blank`.
  El MCP de Chrome se conecta al puerto **9223**.
- `--disable-dev-shm-usage` evita `ERR_INSUFFICIENT_RESOURCES` (páginas en blanco). Si aparece, reinicia
  Chrome con ese flag y usa un perfil nuevo.
- Tras reiniciar Chrome **cambian los ids de página**. Vuelve a abrir con `new_page`.
- Un `uid` del snapshot queda obsoleto tras navegar o re-renderizar: toma otro snapshot.
- No ejecutes en paralelo acciones que dependen unas de otras (rellenar campo y pulsar enviar).
- Capturas en blanco: espera a que cargue el módulo (carga diferida) o recarga ignorando la caché.
- Para ver el login en modo oscuro: `localStorage` clave `webforge-ui-preferences` con
  `{"theme":"dark","sidebarExpanded":true}`.

**Ejecución de comandos**
- Los dev servers van con la herramienta de procesos en segundo plano (ver sección 8).
- Las herramientas diferidas (`control_bash_process`, `get_process_output`, `list_processes`, el MCP de
  Chrome y el de Elements) hay que cargarlas con `tool_load` y se invocan con `tool_call`.
- `docker compose` con `container_name` fijo: si cambias el nombre del proyecto, borra el contenedor
  viejo o chocará con el nombre.

**Datos locales**
- **El entorno Docker puede reiniciarse y perder el volumen de Mongo.** Los `.env` sobreviven. Tras
  un reinicio, `npm run db:up` recrea Mongo vacío y vuelve a crear los usuarios: hay que **registrar de
  nuevo** el SuperAdmin.
- Mongoose crea índices nuevos pero **no borra los viejos**: si cambia un índice único, hay que
  eliminar el anterior a mano.
- La sesión vive en `sessionStorage`: **cada pestaña nueva empieza en el login**.

## 13. Decisiones tomadas, pendientes y diferidas

**Decididas**
- Arquitectura modular "screaming", un servicio por módulo, todo en inglés, sin lint de límites.
- Backend con **NestJS + MongoDB (Docker)**; no se usa la arquitectura de WebIAI/DynamoDB de `Repo-prueba`.
- Los **dos logins son distintos**: el SuperAdmin ya está; el del admin de un negocio vendrá después.
- Registro del SuperAdmin con confirmación de contraseña, tipo de documento y términos.
- **Onboarding = servicio propio** (`packages/services/onboarding`, puerto 8081, base `onboarding`): teléfono único entre
  usuarios (E.164, índice único) y orígenes, un documento por `userId`. Se guarda el teléfono al pulsar *Continuar* (para
  avisar el duplicado ahí) y los orígenes al *Finalizar*. Quien ya completó el perfil no lo repite (los pasos lo llevan a `/`);
  la bienvenida animada (sin Omitir ni Pausar) se ve entera (~11 s) solo si el perfil está sin completar; si ya está
  completo, se ve únicamente la primera escena (el logo, 2,6 s) y entra sola a `/`.
- El onboarding valida el token con el **mismo secreto compartido** (HS256) que usa `super-admin-auth`: es la solución
  provisional hasta pasar a firma asimétrica.
- Ramas end to end; flujo `integration → main → test → production`; revisión cruzada de PRs con
  excepción de administrador.

**Diferidas a propósito (no las trabajes sin que lo pidan)**
- Que el SuperAdmin solo exista tras comprar la suscripción de Necto. **Hoy el registro es público.**
- La vista de términos y condiciones.
- Cualquier módulo de negocio (Turnos, Agendamiento, Reservas, Referidos).

**Abiertas / sin responder**
- ¿El login debe abrir en tema **oscuro** por defecto, como la referencia? Hoy sigue el tema único de la
  app (claro).
- Validar la sesión contra el servidor (`GET /auth/super/me`) al cargar y proteger rutas del backend con
  el guard que ya existe, cuando haya datos sensibles.
- Firma **asimétrica** del JWT (RS256/EdDSA): el segundo servicio ya existe y hoy comparte el secreto.
- Cómo levantar varios servicios en local (script con `concurrently` o un compose en la raíz).
- Bundle de WebIAI para los servicios, cuando el registro vuelva.
- `feature/superLogin` se nombró con mayúscula; las ramas nuevas deben ir en minúsculas.

## 14. Cómo retomar el trabajo

1. Lee este documento y, según la tarea, [`arquitectura.md`](arquitectura.md) y
   [`flujo-de-ramas.md`](flujo-de-ramas.md).
2. Revisa el estado real: `git status`, `git log --oneline -10`, `git branch -a`.
3. Levanta el entorno (sección 8) y comprueba que todo responde.
4. **Pregunta qué sigue.** No asumas la siguiente tarea. Candidatos naturales, pero no confirmados: el
   login del admin de un negocio, o portar el primer módulo de negocio.
5. Antes de empezar, confirma rama y alcance con la persona. Trabaja end to end y verifica en el
   navegador.
6. Al terminar, deja actualizados los documentos que cambien (README del módulo o servicio, `docs/` y
   este archivo).

## 15. Mantener este documento

Este archivo es lo primero que leerá la siguiente IA, así que **debe estar al día**. Actualízalo en el
mismo PR cuando cambie alguna de estas cosas:

- Se agrega, quita o termina un módulo o servicio (secciones 3, 4 y 9).
- Cambian herramientas, versiones, puertos o variables de entorno (secciones 5 y 8).
- Cambia el flujo de ramas, las reglas de GitHub o los workflows (sección 7).
- Se decide algo nuevo o se resuelve un pendiente (sección 13).
- Aparece una trampa nueva del entorno (sección 12).
- Cambian las carpetas de referencia (sección 11).

Al actualizarlo, cambia la fecha y el commit de `integration` del encabezado, y **quita lo que ya no
sea cierto** en lugar de acumular notas.
