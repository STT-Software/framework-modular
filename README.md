# Framework Modular

Base común donde se centralizan los módulos de todo el equipo, para trabajar
sobre un mismo proyecto con flujo de Pull Requests.

> - El flujo de ramas (`integration` → `main` → `test` → `production`) está en
>   [`docs/flujo-de-ramas.md`](docs/flujo-de-ramas.md). Léelo antes de abrir tu
>   primer PR.
> - La organización del código (arquitectura modular "screaming") está en
>   [`docs/arquitectura.md`](docs/arquitectura.md).

## Estructura

```
.
├── webiai.config.mjs            Configuración del proyecto (WebIAI)
├── package.json                 Raíz del monorepo
├── lerna.json
├── tsconfig.json
├── docs/
│   ├── flujo-de-ramas.md
│   └── arquitectura.md
├── infra/                       MongoDB de desarrollo (Docker)
└── packages/
    ├── services/
    │   └── super-admin-auth/    Servicio NestJS + MongoDB (ver su README)
    └── apps/
        └── web/                 Bundle app.web
            └── modules/
                └── app/         Aplicación React + Vite + Tailwind
                    └── src/
                        ├── app/       App, rutas, shell y sidebar
                        ├── pages/     Páginas de cada módulo
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
npm run dev:super-admin-auth # servicio NestJS en http://localhost:8080
```

El servicio y MongoDB necesitan archivos `.env`; los pasos están en
[`packages/services/super-admin-auth/README.md`](packages/services/super-admin-auth/README.md).

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
las dependencias de WebIAI. El backend (`packages/services/super-admin-auth`) es
una app NestJS suelta, todavía sin bundle de WebIAI; tampoco existe el de
infraestructura (`cloud.core`).
