# Framework Modular

Base común donde se centralizan los módulos de todo el equipo, para trabajar
sobre un mismo proyecto con flujo de Pull Requests.

> ## Si eres una IA (o retomas el trabajo en una sesión nueva), empieza aquí
>
> **Lee primero [`docs/ai-context.md`](docs/ai-context.md).** Es el documento más importante del
> repo: estado actual, reglas del equipo, cómo levantar todo, herramientas y versiones, carpetas de
> referencia y trampas conocidas. Cualquier IA que trabaje en este proyecto debe leerlo antes de
> actuar y mantenerlo actualizado. (`AGENTS.md` y `.kiro/steering/ai-context.md` remiten a él.)
>
> Después, según la tarea:
> - El flujo de ramas (`integration` → `main` → `test` → `production`) está en
>   [`docs/flujo-de-ramas.md`](docs/flujo-de-ramas.md). Léelo antes de abrir tu primer PR.
> - La organización del código (arquitectura modular "screaming") está en
>   [`docs/arquitectura.md`](docs/arquitectura.md).

## Estructura

```
.
├── webiai.config.mjs            Configuración del proyecto (WebIAI)
├── package.json                 Raíz del monorepo
├── lerna.json
├── tsconfig.json
├── AGENTS.md                    Puntero para IAs: remite a docs/ai-context.md
├── docs/
│   ├── ai-context.md            CONTEXTO PARA IA: léelo primero
│   ├── flujo-de-ramas.md
│   └── arquitectura.md
├── infra/                       MongoDB de desarrollo (Docker)
└── packages/
    ├── services/
    │   └── necto-api/           El backend: monolito modular NestJS + MongoDB con los módulos auth y onboarding (ver su README)
    └── apps/
        └── web/                 Bundle app.web
            └── modules/
                └── app/         Aplicación React + Vite + Tailwind
                    └── src/
                        ├── app/       App, shell, sidebar y registro de módulos
                        ├── modules/   Módulos de negocio (super-admin-auth, onboarding)
                        ├── pages/     Páginas del scaffolding
                        ├── elements/  Componentes UI compartidos
                        ├── layouts/   Layouts base
                        ├── shell/     Sidebar, header y menús
                        ├── stores/    Estado (MobX)
                        ├── hooks/
                        ├── icons/
                        └── utils/
```

La base de la app sale del scaffolding de **WebIAI Elements**.

## Correr en local

Requiere Node >= 22.

```bash
npm install --prefix packages/apps/web/modules/app
npm run dev        # http://localhost:6020
```

Otros comandos desde la raíz:

```bash
npm run typecheck  # tsc --noEmit
npm run build      # tsc -b && vite build
npm run db:up                # MongoDB en Docker
npm run dev:api              # backend (necto-api) en http://localhost:8080
npm run test:api             # pruebas del backend (incluye las reglas de arquitectura)
npm run dev                  # app web en http://localhost:6020
```

Con las tres cosas arriba, el acceso del superadmin está en
`http://localhost:6020/super/login` (y `/super/register`); al iniciar sesión sigue la bienvenida (`/welcome`) y los pasos de perfil. Detalles en
[`src/modules/super-admin-auth/README.md`](packages/apps/web/modules/app/src/modules/super-admin-auth/README.md).

El servicio y MongoDB necesitan archivos `.env`; los pasos están en
[`packages/services/necto-api/README.md`](packages/services/necto-api/README.md).

## Agregar un módulo

1. Crea la página en `packages/apps/web/modules/app/src/pages/<modulo>/`.
2. Regístrala como ruta en `src/app/App.tsx`.
3. Agrega su entrada al menú en `src/app/AppSidebar.tsx`.
4. Abre el PR hacia `integration`.

## Estado de la inicialización

Los archivos de proyecto y el bundle `app.web` se crearon a mano siguiendo la
estructura de WebIAI, porque el registro `npm.pkg.webiai.io` estaba devolviendo
error 500 y `webiai install` no pudo completarse. Cuando el registro vuelva,
hay que correr `webiai install` en la raíz para terminar de enlazar el CLI y
las dependencias de WebIAI. El backend (`packages/services/necto-api`) es
una app NestJS suelta, todavía sin bundle de WebIAI; tampoco existe el de
infraestructura (`cloud.core`).
