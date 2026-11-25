# Módulo business-dashboard (frontend)
El **dashboard general del administrador** y el **marco de la aplicación del negocio** (`BusinessAppShell`: navegación lateral, barra superior, búsqueda ⌘K, actividad, cuenta y avisos).
El diseño sale de la referencia `necto-dashboard-admin` (carpeta `referencias html/`, ignorada por git), **sin** sus controles de demostración («Probar perfiles», datos de ejemplo, «maqueta»). Todo lo que muestra lo cuenta el servidor
(`necto-api`, módulos `business-dashboard` y `turnos`; contrato en su README).
## Rutas
| Ruta | Pantalla |
|------|----------|
| `/business/app/:businessId` | Resumen del negocio: los módulos asignados, su estado real e indicadores de Turnos (solo si ya está preparado). |
| `/business/app/:businessId/modules` | «Mis módulos». |
Si el servidor dice `entry: "setup"` (falta algo por configurar) la pantalla **no** muestra un dashboard a medias: lleva a donde se continúa (`/business/setup/:id` o `/business/turnos/:id/profile`). Tras el acceso, el administrador entra aquí; el operador va
directo a su primera vista de Turnos y nunca ve este dashboard (el servidor responde `404` a su sesión).
## Dependencias entre módulos
- `business-access` (por su `index.ts`): sesión, `AccessError`.
- `businesses` (por su `index.ts`): `categoryLabel`.
- `turnos` importa de aquí el marco (`BusinessAppShell`, `PageHeading`, `AppDialog`, piezas de `ui.tsx`) por `index.ts`. Reservas, Agendamiento, Referidos, Inventario y Pedidos aparecen como tarjetas con su estado, sin pantallas propias.
## Notas
- Estilos de la referencia con prefijo `nd-` (`styles/business-app.css`), con modo oscuro y `prefers-reduced-motion`. El cliente llama a `/api/dashboard` (proxy de Vite).
- Sin pruebas automáticas del frontend; se verificó a mano en el navegador contra el backend real.
