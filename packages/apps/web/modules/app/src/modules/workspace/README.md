# Módulo workspace (frontend)

El **workspace de negocios**: la pantalla a la que llega el SuperAdmin cuando ya inició sesión y completó su perfil
(teléfono y dónde nos conoció). Muestra el **directorio de sus negocios** (reales, del backend) o, si no tiene ninguno, la
invitación animada a crear el primero. El workspace es el marco (layout) y las rutas; los datos, el asistente de creación y la
ficha son del módulo [`businesses`](../businesses/README.md), que importa por su puerta pública.

El diseño sale de la referencia visual `necto-workspace` (vive solo en la máquina de quien la tiene: `referencias html/`,
ignorada por git): marca y colores de Necto, tipografía DM Sans, tema claro/oscuro y la animación de la tienda.

## Ruta

| Ruta | Pantalla |
|------|----------|
| `/workspace` | Directorio de negocios (lista real con filtros, o estado vacío). |
| `/workspace/businesses/new` | Crear un negocio (asistente de 3 pasos). |
| `/workspace/businesses/:id/edit` | Editar un negocio conservando su id. |
| `/workspace/profile` | Mi perfil: solo el nombre de la persona. |

Solo se entra con sesión de SuperAdmin **y** con el perfil de onboarding completo; esas dos puertas las pone la app, no el módulo
(`requiresSuperAdmin` y `requiresOnboardingCompleted` en su definición). Sin sesión lleva a `/super/login`; con sesión pero sin
perfil completo, a `/welcome`. `/` redirige a `/workspace`.

Flujo completo: `/super/login` → `/welcome` → *Comenzar* → `/welcome/phone` → `/welcome/source` → `/workspace`.

## Qué se ve

- **Lateral flotante colapsable (`BaseAppSidebar`):**
  - Expandida: tarjeta flotante de `274 px` con logotipo, tarjeta de identidad ("Mi workspace"), secciones colapsables con `MenuSectionHeader` / `MenuItem` (*Negocios* con contador, *Crear negocio* y *Mi perfil*), el remate decorativo de marca ("Todo empieza con una buena conexión.") y pie fijo con *Cerrar sesión*. En móviles actúa como cajón deslizante con `Backdrop`.
  - Contraída (modo riel, `BaseAppSidebar bareRail`): sin tarjeta, dos píldoras blancas flotantes. Centrada en altura, la del botón *Expandir* (círculo naranja en claro, índigo en oscuro) con *Negocios* y *Crear negocio*; abajo *Mi perfil* y *Cerrar sesión*. La N de Necto (`WorkspaceRailMark`) ocupa la esquina superior izquierda en lugar del botón bento (`ToggleAppSidebar collapsedSlot`). Íconos simples dentro de cada píldora; la sección actual lleva un círculo gris suave, con punto de aviso y tooltips al pasar el cursor.
- **Barra superior flotante (`BaseAppHeader`):** botón bento para alternar la barra lateral (`ToggleAppSidebar`; con el lateral contraído, la esquina superior izquierda muestra la N y el botón de expandir va en el riel), **selector de negocios (`WorkspaceBusinessSwitcher`)** — muestra el contexto activo ("Mi workspace / Administración" o el negocio en edición) y despliega el portafolio sin filtros mediante `ShellDropdown` para volver al directorio, abrir la ficha completa de cualquier negocio, ir directo a su edición o crear uno nuevo —, ruta de navegación con `Breadcrumb` de Elements, indicador de rol (*Superadministrador*, visible desde `xl`), selector de tema animado (`ThemeToggleButton`), **menú de ayuda y soporte (`WorkspaceSupportDropdown`)** — tarjeta de tutoriales, *Central de ayuda* y *Chatear en Vivo* conectados al widget flotante mediante `openSupportWidget`, contacto directo por WhatsApp y recursos próximos con aviso en línea —, **centro de notificaciones (`WorkspaceNotificationsDropdown`)** — avisos reales de primeros pasos, negocios pausados con acceso a su ficha y anuncio oficial de Necto, con estado leído/descartado persistido por cuenta en `localStorage` — y menú de cuenta (`ShellDropdown`) con iniciales y cierre de sesión. Los dos menús comparten el mismo contenedor y el mismo estilo minimalista: filas de ícono + texto sin cajas, naranja solo como acento (punto de no leído y contador), y las ilustraciones en tarjeta gris (anuncio de Necto, tutoriales). Las ilustraciones solo se colorean con clases `ws-art-*` (variables de `ws-art-scope`), así respetan el tema claro/oscuro. Todos los menús desplegables y la ficha compartida se cierran automáticamente al cambiar de ruta.
- **Widget flotante de soporte y chat en vivo (`WorkspaceSupportWidget`):** botón lanzador naranja arrastrable con captura de puntero y posicionamiento adaptativo de la ventana flotante según el cuadrante visible. Incluye vista de inicio (canales favoritos de chat, WhatsApp y correo `soporte@necto.co`, buscador y píldoras por categoría: *Negocios*, *Accesos OTP* y *Módulos*), vista de detalle de artículo con salto al chat, y chat en vivo con temas rápidos, indicador de escritura de tres puntos y respuestas locales deterministas sobre Necto (`supportKnowledge.ts`). Puede abrirse también desde cualquier control mediante `openSupportWidget("home" | "chat")`. El historial del chat vive únicamente en estado local montado dentro de `WorkspaceLayout`, por lo que se reinicia automáticamente al cerrar sesión sin fugas entre cuentas.
- **Directorio:** título, *Exportar CSV* (apagado hasta que haya negocios; descarga los de la vista filtrada), *Crear negocio*,
  buscador y filtros por industria y estado (apagados mientras no haya negocios), tarjetas con paginación y, si no hay ninguno,
  el estado vacío con la **tienda animada**. *Ver ficha completa* abre la ficha (Resumen, Módulos y Equipo).
- **Animación de la tienda:** al entrar, se arma (el edificio sube, el toldo cae, una línea se dibuja y el logotipo aparece) y
  **después no se detiene**: la casa "respira", el toldo ondea, las fichas y el logotipo flotan, la chispa pulsa y la órbita punteada
  gira, sin fin. Seguir pulsando *Crear negocio*, repetir la entrada o cambiar de tema no la interrumpe. El botón de la esquina del
  estado vacío repite la entrada. Solo se apaga si el sistema pide menos movimiento (`prefers-reduced-motion`), por accesibilidad.
- **Mi perfil:** una vista con el avatar y el **nombre** del usuario (el de su cuenta), y nada más. Se llega desde *Mi perfil* del
  lateral o desde el avatar de la barra superior.

## Comportamiento a tener en cuenta

- **Selector de negocios y ficha compartida:** `WorkspaceLayout` provee `WorkspaceDetailContext` y monta una única instancia de `BusinessDetailDialog` para todas las rutas `/workspace/*`. Tanto las tarjetas del directorio (*Ver ficha completa*) como el selector superior (`WorkspaceBusinessSwitcher`) abren la misma ficha; al pausar o reanudar se actualiza tanto el directorio como el selector (`businessesStore.replace`) y se anuncia en la región viva de `WorkspaceLayout`. El selector consulta su propia lista sin filtros (`businessesStore.loadSwitcher()`, hasta 50 negocios) sin afectar los filtros ni la paginación del directorio, y se invalida al crear o editar un negocio (`businessesStore.invalidate()`).
- **Crear negocio** (el del encabezado, el selector superior y el del estado vacío) lleva a `/workspace/businesses/new`. Al guardar, vuelve al directorio con
  un aviso que se puede cerrar; el estado real de la invitación al jefe está en la ficha, pestaña Equipo.
- Los **datos son del servidor**: cada superadmin ve solo sus negocios; uno ajeno o inexistente responde "no encontrado".
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
├── paths.ts · initials.ts          Rutas (y la de editar por id) e iniciales del avatar
├── pages/
│   ├── WorkspacePage.tsx           Directorio de negocios: animación, aviso, exportar CSV y crear
│   ├── BusinessSetupPage.tsx       Crear (`/new`) y editar (`/:id/edit`): monta el asistente de `businesses`
│   └── ProfilePage.tsx             Mi perfil: solo el nombre
├── components/
│   ├── WorkspaceLayout.tsx         Marco común: lateral, barra superior, pie, región viva, `BusinessDetailDialog` único y `WorkspaceSupportWidget`
│   ├── WorkspaceDetailContext.tsx  Contexto compartido para abrir y cerrar la ficha desde cualquier ruta `/workspace/*`
│   ├── WorkspaceSidebar.tsx        Lateral
│   ├── WorkspaceTopbar.tsx         Barra superior y menú de cuenta
│   ├── WorkspaceBusinessSwitcher.tsx      Selector superior de negocios (hub de portafolio con `businessesStore.loadSwitcher`)
│   ├── WorkspaceSupportDropdown.tsx       Menú desplegable de ayuda y soporte (abre `WorkspaceSupportWidget` vía `openSupportWidget`, contacto por WhatsApp y recursos próximos)
│   ├── WorkspaceSupportWidget.tsx         Widget flotante arrastrable de soporte y chat en vivo (exporta `WorkspaceSupportWidget` y `openSupportWidget`)
│   ├── WorkspaceNotificationsDropdown.tsx Centro de notificaciones conectado al portafolio de negocios y anuncio oficial de Necto
│   ├── workspaceArt.tsx                   Ilustraciones de los menús (notificaciones vacías, anuncio Necto, tutoriales) e íconos por tipo de aviso, en el lenguaje de las escenas de Necto
│   ├── BusinessDirectory.tsx       Encabezado, filtros, tarjetas y paginación (datos del store de `businesses`)
│   └── BusinessEmptyState.tsx      La tienda animada y la invitación a crear el primer negocio
├── support/
│   ├── supportKnowledge.ts         Base de preguntas frecuentes de Necto, temas rápidos, filtrado por categoría/consulta y respuestas locales del chat
│   └── supportKnowledge.test.ts    Pruebas unitarias (Vitest) de `filterSupportFaqs` y `replyToSupportQuestion`
└── styles/
    ├── workspace.css               Estilos (prefijo `ws-`) y animaciones, claro y oscuro
    └── support-widget.css          Animaciones y transiciones del widget flotante (prefijo `ws-support-`), con soporte para `prefers-reduced-motion`
```

## Dependencias

- **Backend:** el de `businesses`, a través de ese módulo (el workspace no llama al servicio por su cuenta).
- **Otros módulos**, solo por su puerta pública: `super-admin-auth` (`superAdminSessionStore`, para el nombre, el avatar y cerrar
  sesión) y `businesses` (store, tarjetas, ficha y asistente). `businesses` **no** importa al workspace: no hay ciclo. No depende del onboarding, y a la inversa tampoco: el onboarding solo conoce la ruta `/workspace`; la app es quien
  consulta su perfil antes de abrir el workspace.
- **Elements:** `Button`, `Input`, `Select` y `Breadcrumb`, con el acabado del diseño por `className` o composición; no se tocó `src/elements/`.
- **Base común (`@/shell` y `@/brand`):** `BaseAppShell`, `BaseAppSidebar`, `BaseAppHeader`, `ToggleAppSidebar`, `ThemeToggleButton`, `ShellDropdown`, `MenuSectionHeader`, `MenuItem`, `PanelToggleIcon`, `NectoLogo`, `uiStore`, `PageMeta` y `cn`.
- **Fuente:** DM Sans (`@fontsource/dm-sans`, subset latin), cargada una sola vez en `src/app/index.tsx`.
