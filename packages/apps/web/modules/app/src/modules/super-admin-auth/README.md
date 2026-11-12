# Módulo super-admin-auth (frontend)

Pantallas de **login** y **registro** del SuperAdmin. Consume el servicio
[`super-admin-auth`](../../../../../../services/super-admin-auth/README.md).

El diseño sale de la referencia visual `necto-superlogin` (dos columnas, panel de
marca con rejilla, brillo y órbitas animadas, tema claro/oscuro). Esa referencia
vive solo en la máquina de quien la tiene (`referencias html/`, ignorada por git).

## Rutas

| Ruta | Pantalla |
|------|----------|
| `/super` | Redirige a `/super/login`. |
| `/super/login` | Inicio de sesión con **usuario o correo** y contraseña. |
| `/super/register` | Registro con usuario, contraseña, correo y documento de identidad. |

Tras iniciar sesión se guarda la sesión y se navega a `/`. Tras registrarse se navega
a `/super/login` con un aviso de "Cuenta creada" y el usuario ya escrito.

## Estructura

```
super-admin-auth/
├── index.ts                    Puerta pública: definición del módulo y sesión
├── SuperAdminAuthLayout.tsx    Layout compartido (formulario + panel de marca)
├── pages/                      LoginPage, RegisterPage
├── components/                 NectoLogo, AuthFields, SubmitButton, AuthThemeToggle, FormHeading
├── api/superAdminAuthApi.ts    Cliente HTTP del servicio (timeout y errores tipados)
├── stores/                     Sesión del superadmin (MobX + sessionStorage)
├── validation.ts               Reglas de los formularios (espejo de las del backend)
└── styles/auth-layout.css      Estilos y animaciones del layout
```

## Lo que ofrece a otros módulos

Desde `@/modules/super-admin-auth`:

- `superAdminAuthModule`: sus rutas (las registra `src/app/modules.ts`).
- `superAdminSessionStore`: `isAuthenticated`, `accessToken`, `superAdmin` y `signOut()`.

## Quién lo usa

`src/app/RequireSuperAdmin.tsx` importa `superAdminSessionStore` (dependencia declarada,
por la puerta pública). Envuelve el shell de la app: sin sesión, `/` y cualquier URL
desconocida llevan a `/super/login`. Con sesión se ve la app. Por ahora es la única
forma de entrar.

## Dependencias

- **Servicio:** `super-admin-auth` (endpoints `/auth/super/register`, `/auth/super/login`, `/auth/super/me`).
- **Elements:** `Button`, `Input`, `Label` y `Alert`. El acabado Necto (altura, foco
  índigo, flecha animada) se aplica con `className` desde este módulo; los
  componentes de `src/elements/` no se modificaron.
- **Base común:** `uiStore` (tema), `PageMeta`, `cn`, colores `necto-*` de `css/theme.css`.
- **Fuente:** DM Sans (`@fontsource/dm-sans`, 400/500/600), cargada solo con este módulo.
- No importa de ningún otro módulo.

## Configuración

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPER_ADMIN_AUTH_API_URL` | URL base del servicio. Por defecto `/api/super-admin-auth`, que el dev server de Vite reenvía al servicio. |
| `SUPER_ADMIN_AUTH_URL` | Solo dev server: dónde corre el servicio. Por defecto `http://localhost:8080`. |

## Comportamiento a tener en cuenta

- Los formularios validan en el navegador con mensajes en español y el servidor
  vuelve a validar. Los errores del servicio se traducen a un aviso entendible
  (credenciales incorrectas, cuenta duplicada por campo, demasiados intentos, sin conexión).
- La sesión se guarda en `sessionStorage`: sobrevive a recargar la pestaña y se borra
  al cerrarla (una pestaña nueva siempre empieza en el login). Si el token ya venció al
  cargar, se descarta. Aún no hay botón de cerrar sesión: `superAdminSessionStore.signOut()`
  existe, falta conectarlo a la interfaz.
- Respeta `prefers-reduced-motion`: sin animaciones para quien lo pide.
- Si el módulo falla al cargar o al renderizar, `ModuleBoundary` lo contiene: se ve un
  aviso con "Reintentar" y el resto de la app sigue funcionando.
