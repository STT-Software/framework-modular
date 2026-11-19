# Contexto para IA: léelo primero

> **Este es el documento más importante del repo para cualquier IA que trabaje aquí**
> (Kiro, Claude, Copilot, Codex u otra). Está pensado para retomar el trabajo en una
> sesión nueva, sin el historial de la anterior. Léelo completo antes de tocar nada.
>
> **Es una foto, no la verdad absoluta.** Actualizado el **2026-11-19**, con `integration` en `8bd511e` (#20) más la configuración de Turnos y el login compartido (`feature/turnos-config`). Si algo de aquí contradice el código, manda el código: verifica con `git log`, `git status` y leyendo los archivos. Y **actualízalo** cuando cambie el estado del proyecto (ver la última sección).

## Índice

1. [Cómo trabajar con este equipo (reglas)](#1-cómo-trabajar-con-este-equipo-reglas)
2. [Qué es el proyecto](#2-qué-es-el-proyecto)
3. [Estado actual](#3-estado-actual)
4. [Mapa del repo](#4-mapa-del-repo)
5. [Stack, lenguajes y versiones](#5-stack-lenguajes-y-versiones)
6. [Arquitectura en resumen](#6-arquitectura-en-resumen)
7. [Flujo de ramas y PRs](#7-flujo-de-ramas-y-prs)
8. [Levantar y verificar todo (runbook)](#8-levantar-y-verificar-todo-runbook)
9. [Contrato del backend](#9-contrato-del-backend)
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
- **Monolito modular "screaming"**: **un solo backend** (`necto-api`: un proceso, un puerto, una base de datos) organizado por
  capacidad de negocio en `modules/<modulo>/` (con capas `api`, `application`, `domain`, `infrastructure` solo si tienen una
  responsabilidad real) y la infraestructura transversal en `platform/`, **+ un módulo de frontend por cada módulo**
  en `src/modules/`. **No crees un servicio nuevo por módulo**: el equipo lo descartó por costoso de operar. Ver [`arquitectura.md`](arquitectura.md).
- **Límites entre módulos del backend:** un módulo solo importa a otro por su `modules/<otro>/public.ts` (nunca repositorios,
  esquemas ni controladores), sin ciclos. Lo comprueba `npm run test:api` (`src/architecture.spec.ts`); no hay linter.
  En el frontend se permite importar de otro módulo por su `index.ts`, declarándolo en su README.
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

La idea es traer todo a `framework-modular` con la arquitectura nueva (modular: un backend con módulos
independientes). **Hoy está construido el acceso del SuperAdmin, su bienvenida con perfil (onboarding: teléfono y dónde nos conoció) y su workspace de negocios (vacío: aún no hay módulo de negocios).**

**Actores del producto (según lo hablado):**
- **SuperAdmin**: administra toda la plataforma. Inicia sesión con usuario o correo + contraseña.
  En el futuro solo existirá si compra la suscripción de Necto (no se trabaja todavía).
- **Admin de un negocio**: tendrá su **propio login**, distinto al del SuperAdmin. Todavía no está
  construido. En `Repo-prueba` existe una versión *mock* con código OTP; es solo referencia.

## 3. Estado actual

### Construido y en `integration`

| Pieza | Dónde | Estado |
|-------|-------|--------|
| Backend: monolito modular `necto-api` (login/registro del SuperAdmin + onboarding) | `packages/services/necto-api` (un solo proceso, puerto 8080) | Funciona, probado con MongoDB real. `platform/` (config, database, security, errors, observability) + `modules/auth` + `modules/onboarding` |
| MongoDB de desarrollo (Docker) | `infra/` | Funciona; una base (`super_admin_auth`) y un usuario para el backend |
| Pantallas `/super/login` y `/super/register` | `packages/apps/web/modules/app/src/modules/super-admin-auth` | Funcionan, conectadas al servicio; enlaces cruzados bidireccionales con `/business/access` (`AuthCrossLinks`) y 5 slides estáticos rotativos en registro (`RegisterScenes`). El registro verifica el correo con un código de 6 dígitos (`RegisterCodeStep`) antes de crear la cuenta y entra directo a `/welcome`; el paso del código es una pantalla enfocada de una columna (sin panel naranja) con la ilustración del código animada arriba (`src/brand/CodeVerificationArt.tsx`, compartida con business-access): al acertar el código el sobre se cierra antes de entrar. Probado en navegador con Mongo y Mailpit |
| Cerrar sesión | `src/app/SignOutButton.tsx` | Funciona (borra la sesión del navegador) |
| Módulo `onboarding` del backend | `packages/services/necto-api/src/modules/onboarding` | Funciona, probado con MongoDB real: guarda teléfono (`onboarding_profiles`, único entre usuarios), dónde nos conoció y si ya vio la intro (`onboarding_intro_views`, vía `PUT /onboarding/profile/intro-seen`) |
| Onboarding (bienvenida + perfil) | `src/modules/onboarding` (README propio) | Funciona: `/welcome` muestra la intro una sola vez por cuenta (en cualquier dispositivo, vía `introSeen`), sin botón para saltarla: cuatro actos con ilustraciones vectoriales editoriales del lenguaje de `RegisterScenes`/`BrandScenes` (clases `ob-art-*`, piezas que entran escalonadas) y el cierre con la animación del logotipo, y luego lleva a `/welcome/phone` → `/welcome/source` → `/welcome/ready` (formas de marca como decoración fija, `GeometryBackdrop`) → pantalla de carga «El cruce» (`WorkspaceLoader`) → `/workspace`. Con `introSeen` o perfil completo, `/welcome` entra directo en `WorkspaceLoader` |
| Workspace de negocios | `src/modules/workspace` (solo frontend, README propio) | Funciona: `/workspace` sobre el shell flotante (`BaseAppShell`: lateral colapsable en modo riel, cabecera `BaseAppHeader` con selector rápido de negocios `WorkspaceBusinessSwitcher`, ficha compartida `BusinessDetailDialog` en `WorkspaceLayout`, menús de ayuda `WorkspaceSupportDropdown` y notificaciones `WorkspaceNotificationsDropdown` con ilustraciones `workspaceArt.tsx`, y widget flotante arrastrable de soporte/chat `WorkspaceSupportWidget`); `/workspace/profile` ("Mi perfil") muestra solo el nombre del usuario. Solo se entra con sesión **y** perfil completo |
| Puertas de acceso | `src/app/RequireSuperAdmin.tsx` y `RequireOnboardingCompleted.tsx` | Sin sesión, `/` y URLs desconocidas llevan a `/super/login`; con sesión, a `/workspace`. Los módulos con `requiresSuperAdmin: true` quedan detrás de la primera; los que además llevan `requiresOnboardingCompleted: true` (el workspace) detrás de la segunda: sin perfil completo, `/welcome` |
| Registro de módulos + aislamiento de fallos | `src/app/modules.ts`, `ModuleRoutes.tsx`, `ModuleBoundary.tsx` | Funciona |
| **Negocios (end to end)** | Backend `modules/businesses`; frontend `src/modules/businesses` (store, asistente de 3 pasos, tarjetas y ficha) y el workspace con datos reales | Mezclado en `integration` (PR #9). Verificado con MongoDB real y el navegador |
| **Acceso de administradores de negocio (end to end)** | Backend `modules/business-access` (OTP por correo, sesiones, permisos por negocio y módulo, código temporal del superadmin); frontend `src/modules/business-access` (`/business/access`, de la referencia `necto-login-admin`) y enlace al superadmin en el formulario | Mezclado en `integration` (PR #13, `c66ef6e`; pulido con `InteractiveDotGrid`, `DecorativeCircles`, fondo naranja en claro / `#190088` en oscuro y 5 slides rotativos cada `2.8 s` en `BrandScenes`). 178 pruebas del backend y recorrido real en el navegador |
| **Configuración inicial del negocio (end to end)** | Frontend `src/modules/business-setup` (`/business/setup/:businessId/:step`, README propio) y backend `modules/business-setup` (`/business-setup/businesses/:businessId/*`): módulos asignados, datos del negocio (se escriben en el documento del negocio, sin copia), descripción, logo PNG/JPG ≤ 1 MB, horarios con herencia, tipo «Otra», progreso recuperable y «base preparada». Referencia visual: `referencias html/necto-negocios-configuracion.html` | Backend: 275 pruebas (282 con MongoDB real, opcional) y recorrido HTTP real. Frontend: verificado a mano en el navegador contra el backend real (acceso con código, guardado por paso, herencia de horarios, «Otra», guardar base y reingreso); sin pruebas automáticas del frontend. En la rama `feature/business-setup` |
| **Configuración de Turnos y login compartido administrador/operador (end to end)** | Backend `modules/turnos` (`/turnos/businesses/:businessId/*`): perfil de atención, filas, reglas generales con herencia campo por campo, operadores, eliminación con reasignación y guardado; `business-access` ahora sirve a **administradores y operadores** con el mismo OTP (`accesses[]`, `@OperatesModule`, `MemberAccessRegistry`); la configuración base elige el perfil de Turnos y la tarjeta del módulo refleja su estado. Frontend `src/modules/turnos` (`/business/turnos/:businessId/:step`, README propio). Referencia visual: `referencias html/necto-configuracion-turnos.html` | Backend: 443 pruebas (8 más contra MongoDB real, opcional) y 116 comprobaciones HTTP reales (permisos de ambos roles, aislamiento, OTP real por Mailpit). Frontend: verificado a mano en el navegador contra el backend real (perfil, filas, reglas cruzadas, operador, reasignación, guardar, login del operador y rechazo de la configuración); sin pruebas automáticas del frontend. En la rama `feature/turnos-config` |
| CI de promoción de ramas | `.github/workflows/` | Existe; `production` aún no se ha promovido nunca |

El registro pide: usuario, contraseña + confirmación, correo, tipo y número de documento
(`CC`, `CE`, `PA`, `NIT`) y aceptación de términos.

### Lo que NO existe (no lo des por hecho)

- **Operación de los seis módulos**: tras entrar, `/business/access` lleva a la configuración (administrador) o a la vista del operador. Existen la configuración base (`business-setup`) y **la configuración de Turnos** (filas, reglas, operadores), pero **no** emitir ni atender turnos, llamados, pantalla de sala ni estadísticas; los demás módulos (reservas, agendamiento, referidos, inventario, pedidos) siguen sin configuración propia y el backend marca su `settings.status` como `pending`. Existen los guards (`@BusinessAdminOnly`, `@RecentlyVerified`, `@RequiresBusinessModule`, `@OperatesModule`) para que cada módulo futuro proteja sus rutas.
- **Envío real de correo (el OTP real)**: el código se genera, protege y valida de verdad, pero no hay credenciales SMTP ni dominio remitente, así que solo se verificó contra Mailpit (local). Para enviarlo a un buzón real hacen falta `MAIL_SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` con dominio verificado (SPF/DKIM) y un buzón de prueba. Nunca afirmes que un correo "llegó": solo hay `accepted` por el proveedor.
- **Pruebas automáticas contra MongoDB y del frontend** del acceso de administradores (sí hay 164 del backend con repositorios en memoria; las sesiones y los índices reales se verificaron a mano).
- Los seis **módulos funcionales** (reservas, turnos, agendamiento, referidos, inventario, pedidos) como sistemas: solo existen el catálogo y la habilitación por negocio.
- Los módulos **Turnos, Agendamiento, Reservas y Referidos** no están portados a este repo.
- La **vista de términos y condiciones** (el enlace del registro no navega: `TERMS_PATH` está vacío
  en `components/TermsCheckbox.tsx`).
- **Validación de la sesión contra el servidor**: la puerta de acceso solo mira que haya un token
  guardado y no vencido. No hay todavía rutas protegidas que lo exijan al servidor.
- **Endpoint de logout**: el JWT no tiene estado; cerrar sesión solo lo borra del navegador.
- **Pruebas automáticas del frontend**: no hay. El backend sí tiene (`npm run test:api`: casos de uso, seguridad y reglas de arquitectura), pero sin pruebas de integración con MongoDB (eso se verifica a mano).
- Bundle de **WebIAI** para el servicio (ver sección 12).

### Entorno en el momento de escribir esto

- El PR #3 (login y registro del SuperAdmin) está **mezclado** en `integration`.
- Al final de la sesión anterior **el entorno Docker se reinició y se perdieron los datos de
  MongoDB** (volumen e imagen). Los archivos `.env` y `node_modules` sí se conservaron, porque viven en
  `/workspaces`. La cuenta `oscarprueba` que la persona había creado **ya no existe**: hay que
  volver a registrarla.
- Se verificó un **arranque en frío completo** (sección 8): Mongo, servicio y web funcionan.
- El onboarding se hizo primero como un servicio separado (PR #6, **cerrado sin mezclar**) y luego se movió al mismo
  backend. En el Mongo de esa sesión quedó una base `onboarding` y su usuario, ya sin uso; el perfil real que había se
  **copió** a `super_admin_auth.onboarding_profiles`. En un Mongo nuevo nada de esto existe.

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
    │   └── necto-api/             EL backend (monolito modular NestJS + MongoDB, puerto 8080; README con el contrato de cada módulo)
    │       └── src/{main.ts, app.module.ts,
    │                platform/{config,database,security,errors,observability},
    │                modules/{auth,onboarding,businesses,business-access,business-setup,turnos}/{public.ts, api, application, domain, infrastructure}}
    └── apps/web/modules/app/      App React + Vite + Tailwind
        ├── .kiro/skills/webiai-elements/SKILL.md   Guía del MCP de Elements
        └── src/
            ├── app/               App, shell, sidebar, registro de módulos, puerta de acceso, ModuleBoundary
            ├── modules/super-admin-auth/   Primer módulo (README propio)
            ├── modules/onboarding/         Bienvenida + pasos de perfil (teléfono, dónde nos conoció) (README propio)
            ├── modules/workspace/          Workspace de negocios: sidebar, barra superior y directorio vacío (README propio)
            ├── modules/business-setup/     Configuración inicial del negocio por su administrador (README propio)
            ├── modules/turnos/             Configuración de Turnos (administrador) y vista del operador (README propio)
            ├── brand/             NectoLogo (logotipo vectorial completo o solo la marca): lo usan onboarding y workspace
            ├── elements/          Componentes de Elements instalados (no se modifican)
            ├── css/theme.css      Tema y tokens (incluye los colores `necto-*`)
            ├── shell/ layouts/ icons/ hooks/ utils/ stores/   Base común del scaffolding
            └── pages/WelcomePage.tsx   Página de ejemplo del scaffolding; ya no se usa (`/` redirige a `/workspace`)
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

- **Un solo backend** (`necto-api`: proceso, puerto, base y `.env` únicos): un monolito modular con `platform/` (infraestructura
  transversal) y `modules/<modulo>/` (una capacidad de negocio con su puerta pública `public.ts`), **+ un módulo de frontend por cada uno**.
- El backend tiene su base de datos (`super_admin_auth`, nombre histórico; el código solo conoce `MONGODB_URI`) y **su usuario de
  Mongo, limitado a esa base**. Cada módulo es dueño de sus colecciones: `auth` -> `super_admins`, `onboarding` -> `onboarding_profiles`.
- **Seguridad en tres piezas** (`platform/security`): `AuthenticationGuard` (quién eres; no mira roles), `SuperAdminGuard` (solo el
  rol `superadmin`; `403` si es otro) y las reglas de negocio de cada módulo. Los módulos reciben la identidad con `@CurrentUser()`.
- El frontend es una sola app. Cada módulo vive en `src/modules/<modulo>/`, expone su
  definición por `index.ts` (rutas) y se registra en `src/app/modules.ts`.
- Las rutas de cada módulo van con `React.lazy` y dentro de un `ModuleBoundary`: si un módulo falla
  al cargar o al renderizar, se contiene y el resto de la app sigue funcionando.
- El navegador llama a `/api/super-admin-auth/...` y `/api/onboarding/...`; el **proxy del dev server de Vite** reenvía las
  dos al **mismo backend** (`API_URL`, por defecto `http://localhost:8080`; `SUPER_ADMIN_AUTH_URL` se sigue aceptando). Fuera de desarrollo hay que
  definir `VITE_SUPER_ADMIN_AUTH_API_URL`, `VITE_ONBOARDING_API_URL` y `CORS_ORIGIN` en el backend.
- Límites conocidos (más detalle en `arquitectura.md`): un solo proceso significa que un fallo grave tumba **todos** los
  módulos del backend a la vez (la separación protege el código, no la disponibilidad), y una sola instancia de Mongo
  sirve a todo en desarrollo.

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
cp infra/.env.example infra/.env                              # completar 2 contraseñas
cp packages/services/necto-api/.env.example packages/services/necto-api/.env
openssl rand -hex 16     # cada contraseña de infra/.env
openssl rand -hex 48     # JWT_SECRET (mínimo 32 caracteres)
npm install --prefix packages/services/necto-api
npm install --prefix packages/apps/web/modules/app
```
La contraseña de `MONGODB_URI` (servicio) debe ser igual a `SUPER_ADMIN_AUTH_DB_PASSWORD` de `infra/.env`.

**Arranque (3 procesos)**
```bash
npm run db:up                  # MongoDB en 127.0.0.1:27017 (espera a que esté "healthy")
npm run dev:api               # backend necto-api (auth + onboarding) en http://localhost:8080
npm run dev                    # app web en http://localhost:6020
```
- **Si eres una IA con herramienta de procesos en segundo plano**, lanza los dos `npm run dev...`
  con esa herramienta (en Kiro: `control_bash_process`, que hay que cargar antes con `tool_load`).
  Si los pones en el comando normal del shell, la herramienta avisa y **no los ejecuta**.
- Si `infra/.env` y los datos de Mongo no coinciden (por ejemplo, perdiste el `.env`), la base no
  acepta las contraseñas: borra el volumen con `docker compose -f infra/docker-compose.yml down -v` y
  vuelve a levantar. **Esto borra los datos.**
- **El puerto 6020 puede estar ocupado por otro proyecto.** `Repo-prueba` usa el mismo puerto: si su Vite está corriendo, el
  de este repo no arranca ahí (o, sin `--strictPort`, salta a otro puerto). Antes de probar, mira qué proyecto responde
  (`<title>`: este es "Framework Modular"; el otro, "WebForge Elements") y, si hace falta, levanta este con
  `npm run dev -- --port 6021 --strictPort` dentro de `packages/apps/web/modules/app`. **No cierres el proceso del otro proyecto.**
- Un proceso en segundo plano puede **salir solo sin error en el log**: antes de probar, comprueba `/health` del backend
  y que Vite responda.

**Verificación rápida**
```bash
curl http://localhost:8080/health                              # backend directo
curl http://localhost:6020/api/super-admin-auth/health         # a través del proxy de Vite
curl http://localhost:6020/api/onboarding/health               # la otra ruta del proxy (mismo backend; reinicia Vite si cambias vite.config.ts)
```
Pantallas: `http://localhost:6020/super/login` y `/super/register`; tras iniciar sesión, `/welcome`,
`/welcome/phone`, `/welcome/source` y por último `/workspace`. Al abrir `/` sin sesión te manda
al login y con sesión al workspace. Sesión y datos: ver trampas en la sección 12.

**Comprobaciones antes de entregar**
```bash
npm run typecheck             # frontend
npm run build                 # frontend (tsc -b && vite build)
npm run build:api
npm run test:api              # pruebas del backend (incluye las reglas de arquitectura)
```

**Limpiar datos de prueba** (borra solo por nombre de usuario, nunca todo):
```bash
PW=$(grep '^MONGO_ROOT_PASSWORD=' infra/.env | cut -d= -f2-)
docker exec framework-modular-mongo mongosh --quiet -u root -p "$PW" --authenticationDatabase admin \
  super_admin_auth --eval 'db.super_admins.deleteMany({username:"mi.cuenta.de.prueba"})'
```
El perfil de esa cuenta vive en otra **colección de la misma base** (`onboarding_profiles`, campo `userId` = `_id` de la
cuenta): bórralo también, buscando primero el id de tu cuenta de prueba. El teléfono es único, así que un perfil de prueba
olvidado bloquea ese número.

**Limitaciones al probar**
- `register` y `login` aceptan **5 peticiones por minuto por IP**; la sexta da `429`. Espacia las pruebas.
- `PUT /onboarding/profile/phone` acepta **10 por minuto por IP** (cuentan también las que dan `400`).
- Si tu Mongo viene de una versión anterior del esquema, hay que borrar el índice
  `identityDocument_1` (el actual es compuesto: tipo + número).

## 9. Contrato del backend

Un solo servicio (puerto 8080) con cuatro módulos. El contrato completo y vigente de cada uno está en el README del servicio.

### Módulo auth

Contrato completo y vigente en
[`packages/services/necto-api/README.md`](../packages/services/necto-api/README.md).
Resumen:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/auth/super/register` | Inicia el registro: envía un código al correo. **No** crea la cuenta (`202`). |
| `POST` | `/auth/super/register/verify` | Confirma el código: crea la cuenta y devuelve `{ accessToken, superAdmin }`. |
| `POST` | `/auth/super/register/resend` | Código nuevo para un registro pendiente. |
| `POST` | `/auth/super/login` | Login con usuario **o** correo. Devuelve `{ accessToken, superAdmin }`. |
| `GET` | `/auth/super/me` | Perfil del autenticado (`Authorization: Bearer <token>`). |
| `GET` | `/health` | Estado. |

Registro: `username`, `email`, `password`, `identityDocumentType` (`CC`/`CE`/`PA`/`NIT`),
`identityDocument`, `acceptTerms` (debe ser `true`). Login: `identifier`, `password`.

- Contraseñas con **bcrypt**. JWT con `sub` y `role: "superadmin"`, vence en 1 h (`JWT_EXPIRES_IN`).
- Únicos: `username` y `email`; el documento es único **junto con su tipo**.
- Usuario inexistente y contraseña incorrecta dan el mismo `401 Invalid credentials` y tardan lo mismo.
- Cualquier campo fuera de la lista se rechaza con `400`.
- Colecciones Mongo: `super_admins` y `pending_registrations`, en la base `super_admin_auth`.

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


### Módulo onboarding

Mismo README: [`packages/services/necto-api/README.md`](../packages/services/necto-api/README.md). Resumen:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/onboarding/profile/me` | Perfil de quien tiene el token: `{ phone, sources, sourceOther, completed, introSeen }` (vacío si no hay). |
| `PUT` | `/onboarding/profile/intro-seen` | Marca que la cuenta ya vio la intro de bienvenida (idempotente, sin cuerpo). |
| `PUT` | `/onboarding/profile/phone` | Paso 1. Cuerpo `{ phone }`: móvil válido con indicativo (`+57…`), normalizado a E.164 canónico con `libphonenumber-js/mobile`. `409` (`code: "phone-in-use"`) si otra cuenta ya lo usa (script de migración `npm run migrate:phones` en `necto-api`). |
| `PUT` | `/onboarding/profile/sources` | Paso 2. Cuerpo `{ sources, sourceOther? }`: hasta 1 opción (`instagram`, `tiktok`, `facebook`, `youtube`, `whatsapp`, `linkedin`, `family`, `business`, `other`) o `[]` para omitir; `sourceOther` opcional (máx. 80 chars, solo con `["other"]`). Marca el perfil como completo. `409` (`code: "phone-required"`) si aún no hay teléfono. |

- Exige el JWT que emite el módulo `auth` (rol `superadmin`); se verifica en el mismo proceso con `AuthenticationGuard` +
  `SuperAdminGuard` de `platform/security` (así `auth` y `onboarding` no se importan entre sí). El id del usuario llega con
  `@CurrentUser()` (viene del `sub` del token), nunca del cuerpo. Sin token `401`; con un rol que no es superadmin `403`.
- Colecciones Mongo: `onboarding_profiles` (`userId` y `phone` **únicos**) y `onboarding_intro_views` (`userId` **único**), en la misma base `super_admin_auth`.

## 10. Frontend: patrones y diseño

**Diseño de referencia:** `referencias html/necto-superlogin.html` (sección 11) y diseño NECTO en StockFlow. Dos columnas:
formulario a la izquierda y panel de marca a la derecha con matriz de puntos blancos que se iluminan al pasar el cursor sin animaciones continuas de fondo (`src/brand/InteractiveDotGrid.tsx`, compartida también con `business-access` sobre panel índigo/oscuro),
aros decorativos (`DecorativeCircles`), mensajes rotativos con transición escalonada (`RotatingBrandMessages`) y cinco ilustraciones vectoriales estáticas rotativas en `/super/register` (`RegisterScenes`, homólogas a `BrandScenes` en `/business/access`); en el paso del código del registro no hay panel (pantalla enfocada) y la escena del código va animada sobre el título (`src/brand/CodeVerificationArt.tsx`, prop `state` para la animación, parametrizada por prefijo de clases `na`/`sa` y usada también por el slide "codigo" de `BrandScenes`). Hooks compartidos entre módulos en `src/hooks/` (p. ej. `useTick`, cuenta atrás que se pausa con la pestaña oculta). Ambos módulos comparten enlaces cruzados bidireccionales (`AuthCrossLinks` y `EmailStep`).
Tema **claro** (panel naranja `#ff3f1a`) y **oscuro** (panel azul profundo `#190088`). Fuente **DM Sans** (300 a 700),
cargada **una sola vez** en `src/app/index.tsx` con `@fontsource/dm-sans/latin-*.css` (sin Google Fonts ni imports por módulo).

**Reglas de rendimiento** (aplicadas en todas las pantallas de acceso, configuración y bienvenida):
- Nada de bucles continuos: `requestAnimationFrame` solo mientras hay algo que mover (`InteractiveDotGrid` se detiene
  con el cursor quieto) y todo temporizador o rotación se pausa con la pestaña oculta (`document.hidden`) y respeta
  `prefers-reduced-motion` (`RotatingBrandMessages`, `BrandScenes`, `useTick(active)`).
- Animar solo `opacity` y `transform`: **no animes `filter`** (el `blur` de los mensajes rotativos se quitó por eso).
  `will-change` solo en lo que está en pantalla (`.ob-art-scene.is-active`, no `.is-past`). En equipos modestos
  (`isLowPowerDevice()`) `ArtStage` apaga los trazos animados.
- En SVG, leer geometría (`getBBox`) en una pasada antes de escribir animaciones.
- Las animaciones CSS sobre elementos SVG (`scale`, `translate`, `stroke-dashoffset`) corren en el hilo principal:
  recalculan estilo y layout en cada cuadro. Que sean cortas: `ArtStage` las pausa tras `settleMs` (14 s por
  defecto; 6 s en `/welcome/ready`) y en equipos modestos apaga destellos y trazos.
- `scrollbar-gutter: stable` solo en el workspace (`html:has(.ws-shell-inner)` en `src/css/base.css`): en las pantallas
  de pantalla completa el hueco reservado mostraba una franja gris a la derecha.
- `/welcome/ready` es una página quieta, con fondo blanco en tema claro: las formas de marca son decoración fija (`GeometryBackdrop`, en `.ob-decor`
  con `contain: strict`) que solo entra una vez con CSS, con parallax según el puntero (Web Animations de `translate`, unas 8 actualizaciones por segundo, sin bucle; no en pantallas táctiles ni con movimiento reducido). Se quitó el juego de formas (física en `requestAnimationFrame`)
  porque hacía lenta la app.
- Carga diferida: `LaunchSequence` solo se descarga en modo intro; los pasos de `/welcome/*` usan los loaders de
  `onboarding/pages/loaders.ts`, que además precargan el paso siguiente.
- Mientras se cargan datos se muestran **skeletons** (`src/components/skeleton/`, propio porque Elements no trae uno)
  con la forma del contenido, no textos tipo "Un momento…".

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
| `/workspaces/framework-modular/referencias html/` | Diseños HTML de referencia. Hoy: `necto-superlogin.html` (login + registro), `necto-negocios-configuracion.html` (configuración inicial del negocio), `necto-onboardingBienvenida.html` (animación de bienvenida), `necto-telefono.html` y `necto-origen` (este último **sin extensión**; los dos son el mismo documento con otra vista inicial: pasos de teléfono y origen). Está en `.gitignore`: solo existe en la máquina de quien la tiene. | Fuente de verdad del **diseño** del login/registro. Para ver su CSS propio, extráelo del `<style>` (trae fuentes en base64 que conviene saltarse). Ábrelo en el navegador para comparar. |
| `/workspaces/Repo-prueba` | Repo de la persona: **Turnos** y **Agendamiento**. Remoto `STT-Software/STT-Necto-Turnos-Agendamiento`, rama `master`. Backend Express + Bun + DynamoDB con el SDK de WebIAI; frontend React con stores *mock* (localStorage). Tiene también un SuperAdmin/negocios/OTP *mock* y el backend de Referidos ya portado (`ReferidosDAO`) con su dominio de frontend, **sin pantallas de referidos**. | Referencia de **qué hacen** Turnos y Agendamiento. Docs útiles en `docs/`: `flujo-modulo-turnos.md`, `flujo-modulo-agendamiento.md`, `flujo-superadmin.md`, `correr-local.md`, `arquitectura-infraestructura.md`. **Su arquitectura es distinta** (WebIAI/DynamoDB); no la copies, tradúcela a la de este repo. |
| `/workspaces/_necto_referidos_src` | Clon superficial (`--depth 1`) y **solo lectura** de `STT-Software/necto_reservas_y_referidos` (rama `main`), repo del compañero: **Reservas** y **Referidos**. Backend: Lambda única con DynamoDB y JWT de Cognito. | Documentación de producto en `Docs/`: `Modulo-Referidos.md`, `Modulo-Reservas.md`, `Producto-Necto-MVP.md`. Referidos: backend en `packages/services/core/src/referrals/`, frontend en `packages/web/app/src/{domain,pages}/referrals/`. **No lo modifiques.** |

Acceso a repos privados: `gh repo clone STT-Software/<repo>` (usa el token de `gh`). `git clone` a
secas falla por autenticación.

Si una carpeta de referencia no existe en tu sesión (porque cambió el entorno), pídesela a la persona
o vuelve a clonarla; no inventes su contenido.

### Módulos businesses y business-access

Contrato completo en el README del servicio. Resumen:

- Superadmin (solo ve **sus** negocios; ajeno = `404`): `GET /businesses/catalog`, `GET /businesses/export.csv`, `GET/POST /businesses`
  (`POST` exige `Idempotency-Key`, 8 a 64 caracteres), `GET/PUT /businesses/:id`, `POST /businesses/:id/pause|resume`,
  `GET /businesses/:id/invitation`, `POST /businesses/:id/invitation/resend`, `POST /businesses/:id/invitation/temporary-code` (código temporal para copiar; ver abajo).
- Administrador de negocio, públicas: `POST /business-access/otp/request {email}` (`202`; **`404 email-not-assigned`** si el correo no es jefe de ningún negocio activo, y la pantalla no avanza: "primero el superadministrador debe invitarte") y `POST /business-access/otp/verify {email, code, remember?}`
  (`200` con `accessToken`, `businesses[]` y la cookie de sesión `HttpOnly`; o `401 Invalid or expired code` genérico).
- Administrador, con la cookie: `GET /business-access/session`, `POST /business-access/session/refresh` (regreso sin otro código),
  `DELETE /business-access/session` (cerrar sesión / olvidar dispositivo).
- Administrador, con el token: `GET /business-access/businesses[/:id]` (solo los autorizados), `GET /businesses/:id/modules/:moduleId`,
  `POST /session/reverify/request` y `/reverify`, `POST /session/revoke-others` (exige verificación reciente).
- Códigos: 6 dígitos, 10 min, un solo uso, 5 intentos, 60 s entre reenvíos, HMAC en la base. **Pertenecen a un correo, no a un negocio**
  (se decide al usarlos qué negocios abren). Sesiones de servidor (`admin_sessions`): normal 2 h inactiva / 12 h; "recordar dispositivo"
  (desactivado por defecto) hasta 30 días como máximo. Token de 10 min que lleva solo el id de sesión; el guard consulta la base en cada petición.
- **Código temporal del superadmin (provisional):** ficha → Equipo → "Generar código temporal". Propósito `manual`, 10 min, un solo uso, nunca se envía por correo (`not-sent`), solo lo ve el dueño una vez; el jefe lo escribe en `/business/access`. Mientras espera, pedir otro código no lo pisa. Quien lo tenga entra como el jefe: **retirarlo o limitarlo cuando el correo real funcione**.
- Errores `400` con `fields`. Los `401/403` de sesión y permisos llevan `code` (`session-expired`, `reverification-required`, `module-not-enabled`).
- Correo: sin `MAIL_SMTP_HOST` el envío queda `failed: not-configured`; `deliveryConfirmed` siempre `false`.
- Variables (en `.env.example`): `OTP_SECRET` (obligatoria, ≥32 caracteres y distinta de `JWT_SECRET`), `PUBLIC_APP_URL`, `OTP_*`, `MAIL_*` y `ADMIN_*`.
- Módulos: `reservas, turnos, agendamiento, referidos, inventario, pedidos` (0 a 6).
### Módulo turnos (configuración de Turnos) y login compartido
Contrato completo en el README del servicio (módulos `turnos` y `business-access`). Resumen:
- **Login compartido.** El mismo OTP por correo sirve a administradores y operadores. `POST /business-access/otp/verify` y `refresh` devuelven `accesses[]` (`{ key, businessId, businessName, category, role: "admin" | "operator", modules, personName }`; `businesses[]` sigue siendo solo lo administrado); `GET /business-access/accesses` da la misma lista. Un correo puede ser jefe de un negocio y operador de otro (o ambos en el mismo): la pantalla pide negocio **y rol**. Sin ningún acceso: `404 email-not-assigned`.
- **Quién decide qué.** `@RequiresBusinessModule('turnos')` (jefe vigente de ESE negocio activo con Turnos) para la configuración; `@OperatesModule('turnos')` (operador de ESE negocio) para la vista del operador. Ser jefe no hace operador y un operador nunca entra a una ruta de administrador: todas dan el mismo `404`. Se comprueba **en cada petición**; retirar la asignación, deshabilitar el módulo, pausar el negocio o reemplazar al jefe cierra el acceso en la siguiente.
- **Operadores sin duplicar identidades.** `business-access` no guarda ni copia asignaciones: `turnos` se registra al arrancar en `MemberAccessRegistry` (`TurnosOperatorAccessSource`) y se le pregunta en cada decisión. Retirar a un operador borra solo su asignación; su correo, su sesión y sus otros accesos siguen.
- Rutas del administrador (`/turnos/businesses/:id`): `GET` (la primera vez genera **una vez** las filas sugeridas), `PUT profile`, `POST|PUT|DELETE queues[/:queueId]`, `PUT rules`, `POST|PUT|DELETE operators[/:operatorId]`, `PUT progress`, `POST complete`. Cada escritura devuelve la configuración completa. Del operador: `GET /turnos/businesses/:id/operator` (él y solo sus filas).
- **Un documento por negocio** (`turnos_configurations`, filas y operadores dentro): fila + operadores cambian en **una sola escritura** condicionada a `version` (con reintentos), así eliminar una fila con reasignación nunca deja a nadie sin fila (`409 reassignment-required` si falta a dónde mover a alguien).
- **Reglas con herencia**: cada fila puede fijar prefijo, urgencia, ocupada y llena por separado; vacío = usa la general. `fullLimit > busyLimit` con la combinación de valores propios **y** heredados (al guardar fila, al guardar reglas y al guardar como preparada).
- **Perfil de atención**: se elige en la configuración base (`PUT /business-setup/…/category { turnosProfile }`) o en el primer paso de Turnos; es el mismo dato (lo guarda Turnos). Cambiarlo nunca borra ni duplica lo hecho (reemplaza solo sugerencias sin tocar; con `addSuggestedQueues` añade las nuevas sin repetir nombres).
- **Guardar** exige al menos una fila y reglas válidas; operadores opcionales. Cualquier cambio posterior la deja otra vez por guardar. La tarjeta de Turnos en `business-setup` muestra `settings.status` `ready`/`pending`.
- El cliente de Vite usa el prefijo `/api/turnos` (ya está en `vite.config.ts`).
### Módulo business-setup (configuración inicial del negocio)
Contrato completo en el README del servicio. Rutas del administrador (token de administrador; el negocio de la URL se verifica en cada petición con `@AdministersBusiness()`; ajeno, inexistente, pausado o con jefe reemplazado = `404`; token de superadmin = `403`):
`GET /business-setup/businesses/:id` (estado completo, para retomar), `GET …/modules`, `PUT …/profile`, `PUT …/category`, `PUT|DELETE|GET …/logo` (multipart, campo `logo`),
`PUT …/schedule`, `PUT …/schedule/modules/:moduleId`, `PUT …/progress`, `POST …/complete`.
- Datos del negocio: se leen y escriben en la colección `businesses` por el contrato público `AdministeredBusinessProfiles`. El administrador **no** cambia módulos, jefe, estado, moneda ni zona horaria; eso es solo del superadmin.
- Lo propio del módulo (`business_setups`, un documento por negocio): descripción, logo, horario base, horarios propios de módulos y progreso. Un módulo hereda el horario del negocio (se calcula al leer) o tiene el suyo (excepción que se conserva).
- Horas `HH:mm` locales del negocio, sin cruzar medianoche, sin solapes; errores con ruta (`schedule.mon.ranges.1.end`) en `fields`. `complete` marca solo la base; cualquier cambio posterior la invalida.
- El cliente de Vite usa el prefijo `/api/business-setup` (ya está en `vite.config.ts`). La imagen del logo necesita el `Authorization`: se descarga con `fetch` y se muestra con un `blob:` URL. Al subir, el navegador reduce la imagen a 256×256 en WebP (se aceptan originales de hasta 10 MB; el archivo subido no pasa de 1 MB) y muestra esos mismos bytes con `URL.createObjectURL`, sin volver a descargarlos. El servicio acepta PNG, JPG y WebP.

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
- **Puerto 6020:** puede estar ocupado por el Vite de `Repo-prueba` ("WebForge Elements"). Comprueba el título de la página: el de este repo es "Framework Modular".
- **Límites que confunden al probar:** el login y el registro permiten 5 por minuto (`429` del throttler) y el OTP limita por IP (30 intentos / 15 min). Tras muchas pruebas seguidas desde `127.0.0.1` verás `429`: espera o vacía `access_rate_limits` (solo contadores de prueba).
- Las pruebas con `node --test` se corren **desde `packages/services/necto-api`** (no desde la raíz) y con el glob entre comillas; los scripts que importan paquetes del proyecto deben estar dentro del proyecto, no en `/tmp`.
- El dev server de Vite redirige `/api/<módulo>` al backend; `businesses`, `business-access`, `business-setup` y `turnos` tienen su prefijo en `vite.config.ts` (si añades otro módulo con API, añade el suyo).
- **Correo local de desarrollo:** `npm run db:up` también levanta Mailpit (SMTP 1025, web `http://127.0.0.1:8025`, imagen fijada en `infra/docker-compose.yml`). El `.env` del backend apunta a él (`MAIL_SMTP_HOST=127.0.0.1`, `MAIL_SMTP_PORT=1025`, `MAIL_SMTP_REQUIRE_TLS=false`); tras cambiar el `.env`, reinicia el backend. Ahí se lee el código del jefe. **No es entrega real.**
- **Pedir otro código antes de 60 s no envía nada.** Aunque el servidor responda `202`, el cooldown de 60 s entre dos códigos del mismo correo cuenta también el código temporal del superadmin y la invitación: al probar un login justo después de generar uno, espera un minuto (o lee el código de Mailpit, `http://127.0.0.1:8025`).
- **El registro del superadmin ahora pide el código del correo** (`/auth/super/register` → `register/verify`): en local se lee de Mailpit.
- **El proxy de Vite quita su prefijo**: el cliente llama a `/api/business-access` + `/business-access/otp/request`; si olvidas el segundo prefijo, el backend responde 404 y la pantalla muestra un error falso.
- **Pruebas de límites en local**: los envíos están limitados por correo (5/hora) y por IP (20/hora); todas las peticiones locales llevan la misma IP. Si una prueba da `429`, vacía `access_rate_limits` (solo contadores).
- **No ejecutes `nest build` mientras corre `npm run dev:api`**: borra `dist/` y el modo watch cae; reinicia el dev server.
- Los esquemas de Mongoose declaran `@Prop({ type: ... })` explícito: las pruebas corren con `tsx`, que no emite metadatos de decoradores.
- **El entorno Docker puede reiniciarse y perder el volumen de Mongo.** Los `.env` sobreviven. Tras
  un reinicio, `npm run db:up` recrea Mongo vacío y vuelve a crear los usuarios: hay que **registrar de
  nuevo** el SuperAdmin.
- Mongoose crea índices nuevos pero **no borra los viejos**: si cambia un índice único, hay que
  eliminar el anterior a mano.
- La sesión vive en `sessionStorage`: **cada pestaña nueva empieza en el login**.

## 13. Decisiones tomadas, pendientes y diferidas

**Decididas**
- **Monolito modular "screaming"**: un solo backend (`necto-api`) organizado por capacidad de negocio (`modules/`) y con la
  infraestructura transversal en `platform/`, + un módulo de frontend por cada módulo; todo en inglés. **Se descartó un servicio
  por módulo** (proceso, puerto, base y usuario de Mongo por módulo): demasiado costoso de operar. El costo aceptado: un solo
  proceso, así que un fallo grave tumba todo el backend. Los límites entre módulos (puerta pública, capas, sin ciclos) se
  comprueban con pruebas, no con un linter.
- Backend con **NestJS + MongoDB (Docker)**; no se usa la arquitectura de WebIAI/DynamoDB de `Repo-prueba`.
- Los **dos logins son distintos**: el SuperAdmin ya está; el del admin de un negocio vendrá después.
- Registro del SuperAdmin con confirmación de contraseña, tipo de documento y términos.
- **Onboarding = módulo del mismo backend** (`modules/onboarding` en `necto-api`, mismo proceso, puerto 8080 y base): teléfono
  único entre usuarios (E.164, índice único), orígenes y registro de intro vista (`onboarding_intro_views`, un documento por `userId`). Al empezar la intro en `/welcome` se marca vista con `PUT /onboarding/profile/intro-seen` (solo la ven usuarios nuevos, una vez por cuenta, sin botón de saltar). Se guarda el teléfono al pulsar *Continuar* (para avisar el duplicado ahí) y los orígenes al *Finalizar* (el paso 2 se puede *Omitir*: guarda la lista vacía y el perfil queda completo igual), pasando luego al cierre `/welcome/ready` (`GeometryBackdrop`). Al pulsar *Comencemos juntos* (y en siguientes inicios de sesión), `WorkspaceLoader` («El cruce») anima la transición mientras consulta el perfil y precarga el workspace (`preloadWorkspacePage`) antes de navegar a `/workspace` (o al paso 1 si el perfil sigue incompleto). **"Mi perfil" en `/workspace/profile` no reabre estos pasos**, solo muestra el nombre.
- **Workspace = destino del onboarding** (`/workspace`, módulo de frontend `workspace`, sin backend propio por ahora). Se entra con
  sesión de superadmin **y** perfil completo (`RequireOnboardingCompleted`, que consulta al backend una vez al entrar; si la consulta
  falla, se trata como incompleto y lleva a `/welcome`). `/` redirige a `/workspace`. Montado sobre el shell flotante (`BaseAppShell`
  con lateral colapsable en modo riel y cabecera `BaseAppHeader`), incluye selector rápido de negocios (`WorkspaceBusinessSwitcher`, con
  lista sin filtros `businessesStore.loadSwitcher()` y ficha compartida `BusinessDetailDialog` en `WorkspaceLayout`), menús de ayuda y
  notificaciones (`WorkspaceSupportDropdown` y `WorkspaceNotificationsDropdown` con ilustraciones `workspaceArt.tsx`), y widget flotante
  arrastrable de soporte/chat en vivo (`WorkspaceSupportWidget`, con FAQs y respuestas locales en `supportKnowledge.ts`). Respeta el tema
  de la app (claro por defecto) y conserva la animación de la tienda en estado vacío (apagada con `prefers-reduced-motion`).
- El logotipo (`brand/NectoLogo`) y el botón de tema redondo (`ThemeIconButton` en `shell`) pasaron a la base común al aparecer el
  tercer uso. `super-admin-auth` conserva su propio `NectoLogo` (colores por clases), pendiente de unificar.
- **Acceso de administradores (`feature/business-admin-access`):** se evolucionó el módulo `business-access` (no se creó otro) y se **reemplazó** el acceso por negocio (`/otp/request` con `businessId`, `business-boss`) por uno por **correo**: así una persona con varios negocios entra una vez y elige. Rol nuevo `business-admin` (token con solo el id de sesión). Sesión de servidor con cookie `HttpOnly`+`SameSite=Strict` (secreto hasheado en la base), token corto en memoria, renovación, revocación inmediata y reverificación para acciones sensibles. La cookie es `Path=/` porque el navegador ve `/api/business-access/...` (proxy de Vite) y no `/business-access/...`.
- **Decisión del dueño del producto:** al pedir el código, un correo sin negocio recibe `404 email-not-assigned` (antes el acceso respondía igual para todos). Revela qué correos están asignados; lo frenan los límites por correo (5/h) y por IP (20/h). Para volver a la respuesta genérica basta con dejar de lanzar `EmailNotAssignedError` en `AdminLoginService.requestCode`. La verificación del código sigue sin decir por qué falla.
- **Qué NO se implementó del acceso, a propósito:** rotación del secreto de la cookie en cada renovación (la sesión se puede revocar al instante, así que se priorizó no romper dos pestañas); lista de dispositivos; reconocimiento de IP.
- **Frontend de negocios:** `businesses` no tiene rutas propias; el workspace (layout) las monta e importa de `businesses` por su `index.ts`, así no hay ciclo. La sesión del jefe es **otra** (`business-access:session`), separada de la del superadmin. No se muestra ningún código en la interfaz del superadmin: el prototipo enseñaba uno "de ejemplo" y se descartó por no ser real.
- **Configuración inicial del negocio (`business-setup`, solo backend por ahora):** módulo nuevo, no un servicio. Escribe los datos del negocio en el documento del dueño por un contrato público de `businesses` (condición de jefe vigente y negocio activo dentro de la misma escritura, que sube `version`) y guarda aparte solo lo nuevo. El horario de un módulo que hereda no se copia: se calcula al leer, así los cambios del negocio se reflejan solos y las excepciones se conservan. Se añadió `kind: 'invalid'` (`400` con `fields`) a `DomainError` para validar horarios con la ruta de cada campo. La moneda y la zona horaria son de solo lectura para el administrador (las fija el superadmin y la zona define cómo se leen los horarios). Límites propios, no pedidos por producto: descripción ≤ 500 caracteres y ≤ 6 franjas por día.
- **Configuración de Turnos y login compartido (`turnos`, end to end):** módulo nuevo en el mismo backend. El rol de la persona **no se guarda** en la sesión ni en el token (`role: business-admin` es histórico y significa «sesión por correo»): se decide en cada petición con los datos de ese momento. `business-access` no importa a `turnos`: este se registra como fuente de asignaciones (`MemberAccessRegistry`/`MemberAccessSource`) y `business-access` solo las acepta con el negocio activo y el módulo habilitado. Filas y operadores viven dentro del documento del negocio para que reasignar al eliminar una fila sea una sola escritura (MongoDB local no tiene transacciones). El perfil de atención pertenece a Turnos aunque se elija en la base (`business-setup` depende de `turnos/public`, nunca al revés). Límites propios, no pedidos por producto: 30 filas y 100 operadores por negocio, nombre de fila ≤ 60, prefijo 1 a 5 caracteres, y todo perfil parte con filas predeterminadas: la categoría sugiere `gastronomy`→`restaurant`, `health-wellness`→`clinic`, `retail` y `professional-services`→`bank`, `other`→`custom` (una fila «Atención general»). Mapeo propio, a confirmar con producto. No se envía correo de invitación al operador (entra cuando el administrador le pasa el enlace de acceso); el diálogo «Ver acceso» no muestra ningún código.
- **Negocios y acceso del jefe** (PR #9, ya en `integration`): `business-access` depende de `businesses/public`, y `businesses` avisa con el evento `BossAssigned` por `platform/events` (sin ciclos). El jefe vive **dentro** del documento del negocio (Mongo standalone sin transacciones: una escritura atómica garantiza un jefe vigente). Creación idempotente con `Idempotency-Key`. El correo se envía en segundo plano y nunca se declara "entregado" (solo `sending`/`accepted`/`failed`). El acceso por negocio que traía ese PR se reemplazó después por el acceso por correo (ver la decisión de `feature/business-admin-access`).
- La sesión vive en `platform/security` (emitir/verificar el token, autenticar, autorizar por rol) para que ningún módulo dependa de otro ni toque el secreto JWT.
- El nombre de la aplicación (`necto-api`) es independiente del de la base de datos (`super_admin_auth`, histórico): renombrar el código no obligó a migrar datos.
- Ramas end to end; flujo `integration → main → test → production`; revisión cruzada de PRs con
  excepción de administrador.

**Diferidas a propósito (no las trabajes sin que lo pidan)**
- Que el SuperAdmin solo exista tras comprar la suscripción de Necto. **Hoy el registro es público.**
- La vista de términos y condiciones.
- Cualquier módulo de negocio (Turnos, Agendamiento, Reservas, Referidos).

**Abiertas / sin responder**
- **`turnos`**: ¿hay que enviar un correo de invitación al operador cuando se le asigna (hoy no: el administrador le comparte el enlace)? ¿Son correctos los límites (30 filas, 100 operadores) y que solo la categoría gastronomía sugiera perfil? ¿Un operador debe poder cambiar de correo (hoy, editar el correo mueve la asignación al correo nuevo y el anterior pierde el acceso)?
- **`business-setup`**: preguntas de producto abiertas: ¿la moneda y la zona horaria deben poder editarlas los administradores? (hoy no); ¿hace falta un tope de franjas por día y de descripción distinto de 6 y 500?
- ¿El login debe abrir en tema **oscuro** por defecto, como la referencia? Hoy sigue el tema único de la
  app (claro).
- Validar la sesión contra el servidor (`GET /auth/super/me`) al cargar y proteger rutas del backend con
  el guard que ya existe, cuando haya datos sensibles.
- Firma **asimétrica** del JWT: solo si algún módulo se separa algún día en su propio servicio.
- **Nombre físico de la base** (`super_admin_auth`): refleja el primer módulo, no la aplicación. Cambiarlo es opcional y sí implica migrar datos (infra, `MONGODB_URI`).
- **Pruebas automáticas del frontend de negocios** (el asistente, la ficha y el acceso del jefe se verificaron a mano en el navegador).
- **Envío real de correo**: faltan proveedor SMTP, remitente con dominio verificado (SPF/DKIM) y un buzón de prueba para confirmar la recepción.
- **Pruebas de integración con MongoDB** (idempotencia, carreras del OTP): hoy se verificaron a mano con el backend real.
- **Tema por defecto del workspace**: la referencia abre en oscuro; hoy sigue el tema único de la app (claro). Misma pregunta abierta que la del login.
- Unificar `NectoLogo` de `super-admin-auth` con `brand/NectoLogo`.
- Módulos de frontend que se importan por la puerta pública: `onboarding`, `workspace` y `businesses` → `super-admin-auth`, y `workspace` → `businesses` (nunca al revés); se podría mover el store de sesión a la base común para que sean independientes.) (Antes: se podría mover el store de sesión a la base común para que sean independientes.
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
