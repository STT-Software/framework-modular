# Módulo workspace (frontend)

El **workspace de negocios**: la pantalla a la que llega el SuperAdmin cuando ya inició sesión y completó su perfil
(teléfono y dónde nos conoció). Hoy muestra el **directorio de negocios vacío**, con la invitación a crear el primero.

Es solo frontend y no guarda ni consulta nada propio: todavía no existe un módulo de negocios (ni su servicio ni su modelo
de datos), así que el directorio siempre tiene 0 negocios.

El diseño sale de la referencia visual `necto-workspace` (vive solo en la máquina de quien la tiene: `referencias html/`,
ignorada por git): marca y colores de Necto, tipografía DM Sans, tema claro/oscuro y la animación de la tienda.

## Ruta

| Ruta | Pantalla |
|------|----------|
| `/workspace` | Directorio de negocios (estado vacío). |
| `/workspace/profile` | Mi perfil: solo el nombre de la persona. |

Solo se entra con sesión de SuperAdmin **y** con el perfil de onboarding completo; esas dos puertas las pone la app, no el módulo
(`requiresSuperAdmin` y `requiresOnboardingCompleted` en su definición). Sin sesión lleva a `/super/login`; con sesión pero sin
perfil completo, a `/welcome`. `/` redirige a `/workspace`.

Flujo completo: `/super/login` → `/welcome` → *Comenzar* → `/welcome/phone` → `/welcome/source` → `/workspace`.

## Qué se ve

- **Lateral** (solo en pantallas anchas): logotipo, nombre del espacio ("Mi workspace"), navegación (*Negocios* con su contador y
  *Mi perfil*) y un remate decorativo.
- **Barra superior:** ubicación ("Mi workspace / Negocios"), el rol (*Superadministrador*), cambio de tema, **cerrar sesión** y el
  avatar con las iniciales del usuario (`admin.root` → `AR`).
- **Directorio:** título, *Exportar CSV* (apagado hasta que haya negocios), *Crear negocio*, buscador y filtros por industria y
  estado (apagados), y el estado vacío con la **tienda animada**.
- **Animación de la tienda:** al entrar, se arma (el edificio sube, el toldo cae, una línea se dibuja y el logotipo aparece) y
  **después no se detiene**: la casa "respira", el toldo ondea, las fichas y el logotipo flotan, la chispa pulsa y la órbita punteada
  gira, sin fin. Seguir pulsando *Crear negocio*, repetir la entrada o cambiar de tema no la interrumpe. El botón de la esquina del
  estado vacío repite la entrada. Solo se apaga si el sistema pide menos movimiento (`prefers-reduced-motion`), por accesibilidad.
- **Mi perfil:** una vista con el avatar y el **nombre** del usuario (el de su cuenta), y nada más. Se llega desde *Mi perfil* del
  lateral o desde el avatar de la barra superior.

## Comportamiento a tener en cuenta

- **Crear negocio** (el del encabezado y el del estado vacío) **no crea nada ni lleva a ninguna pantalla**: solo da la respuesta de
  la referencia (un resplandor sobre la tienda y el aviso "Crear negocio seleccionado." para lectores de pantalla). Qué es un
  negocio y cómo se crea no está definido.
- **Mi perfil** no lleva a los pasos de teléfono y origen del onboarding: esos ya quedaron resueltos y un perfil completo no los
  repite. Muestra solo el nombre; si más adelante debe mostrar o editar otros datos, hay que definirlo.
- **Cerrar sesión** no está en la referencia: se añadió porque el workspace no usa el `AppShell` de la app (que es donde estaba ese
  botón) y sin él no habría cómo salir.
- **Tema:** el botón usa el mismo `uiStore` que el resto de la app. La referencia abre en oscuro; aquí se respeta el tema de la app
  (claro por defecto).
- **Avatar:** las iniciales salen del usuario de la sesión. Sin nombre, `SA`.
- Si el módulo falla al cargar o al renderizar, `ModuleBoundary` lo contiene.

## Estructura

```
workspace/
├── index.ts                        Puerta pública: definición del módulo
├── paths.ts · businesses.ts · initials.ts   Rutas, cantidad de negocios (0) e iniciales del avatar
├── pages/
│   ├── WorkspacePage.tsx           Directorio de negocios; maneja la animación y el aviso de "crear"
│   └── ProfilePage.tsx             Mi perfil: solo el nombre
├── components/
│   ├── WorkspaceLayout.tsx         Marco común: lateral, barra superior y pie
│   ├── WorkspaceSidebar.tsx        Lateral
│   ├── WorkspaceTopbar.tsx         Barra superior
│   ├── BusinessDirectory.tsx       Encabezado, filtros y pie del directorio
│   └── BusinessEmptyState.tsx      La tienda animada y la invitación a crear el primer negocio
└── styles/workspace.css            Estilos (prefijo `ws-`) y animaciones, claro y oscuro
```

## Dependencias

- **Backend:** ninguno.
- **Otro módulo**, solo por su puerta pública: `super-admin-auth` (`superAdminSessionStore`, para el nombre, el avatar y cerrar
  sesión). No depende del onboarding, y a la inversa tampoco: el onboarding solo conoce la ruta `/workspace`; la app es quien
  consulta su perfil antes de abrir el workspace.
- **Elements:** `Button`, `Input` y `Select`, con el acabado de la referencia por `className`; no se tocó `src/elements/`. El
  directorio, el lateral y la barra superior son composición propia (como la referencia).
- **Base común:** `brand/NectoLogo` (logotipo), `ThemeIconButton` (de `@/shell`), `uiStore` (tema), `PageMeta` y `cn`.
- **Fuente:** DM Sans 400/500/600 (`@fontsource/dm-sans`), cargada solo con este módulo.
