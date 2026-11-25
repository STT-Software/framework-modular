# Módulo turnos (frontend)
La **configuración de Turnos** de un negocio, hecha por su **administrador**, y la **vista de su operador**. El diseño sale de la referencia
`necto-configuracion-turnos` (carpeta `referencias html/`, ignorada por git), **sin** sus controles de demostración (el código `123456`, los
datos de ejemplo, la «maqueta local»). Qué puede hacer cada persona, qué valores son válidos y cómo se heredan las reglas lo decide el servidor
(`necto-api`, módulo `turnos`; contrato completo en su README). La **operación** (turnos en marcha, tablero, encuestas, equipo y pantalla de sala) está en la sección «Operación» al final.
## Rutas
| Ruta | Pantalla |
|------|----------|
| `/business/turnos` | Entrada: si la persona administra un solo negocio con Turnos lo abre; si no, la manda a `/business/access`. |
| `/business/turnos/:businessId/profile` | Paso 1, **perfil de atención**: parte del que se eligió en la configuración base (o el que sugiere la categoría). |
| `/business/turnos/:businessId/queues` | Paso 2, **filas**: crear, editar, eliminar (con reasignación de operadores). |
| `/business/turnos/:businessId/rules` | Paso 3, **reglas generales**: prefijo, reinicio diario, urgencia, ocupada y llena, con vista previa del turno. |
| `/business/turnos/:businessId/operators` | Paso 4, **operadores**: nombre, correo, teléfono opcional y una o varias filas. Es opcional. |
| `/business/turnos/:businessId/review` | Paso 5, **revisión** y «Guardar configuración». |
| `/business/turnos/:businessId/operator` | Lo que ve un **operador**: él y solo sus filas. |
Son rutas **sin** la puerta del superadmin: la sesión es la de `business-access` (la misma de administradores y operadores). Sin sesión vigente,
la página lleva a `/business/access`. Se llega desde la tarjeta de Turnos de la configuración base (`/business/setup/:id`) y, el operador, desde «Ver mis filas»
en la pantalla «Ya estás en tu negocio» del acceso.
## Cómo guarda y recupera
- **Filas, operadores y perfil se guardan en el servidor al confirmar su diálogo** (cada escritura devuelve la configuración completa y la pantalla se
  repinta con lo que el servidor guardó). **Las reglas** se guardan al avanzar de paso. Cerrar sesión no pierde nada: al volver, `GET` devuelve todo y la
  persona sigue donde quedó (el paso se recuerda con `PUT /progress`). No se guarda nada en `localStorage` ni `sessionStorage`.
- La **primera vez** que se abre la configuración el servidor genera una sola vez las filas sugeridas del perfil. Cambiar de perfil **nunca borra ni duplica**
  lo que hizo la persona: si las filas siguen siendo las sugeridas sin tocar, se reemplazan; si no, se le pregunta («Solo cambiar perfil» / «Añadir sugerencias»).
- **Herencia de reglas:** cada fila deja vacío lo que no personaliza y usa el valor general, campo por campo; la pantalla muestra «General: …» como pista
  y el servidor devuelve lo que la fila usa de verdad (`effective`). El límite de «llena» debe superar al de «ocupada» con los valores propios **y** los heredados.
- **Eliminar una fila:** quien se quedaría sin ninguna elige a qué fila pasa; fila y operadores cambian en una sola escritura del servidor.
- **Guardar configuración** exige al menos una fila y reglas válidas; los operadores son opcionales. Cualquier cambio posterior la deja otra vez por guardar.
## El operador
- Entra por `/business/access` con su correo y un **código real** que le llega por correo (vencimiento, un solo uso, límites de intentos). El diálogo «Ver acceso»
  del administrador **no muestra ningún código**: da el enlace de acceso para compartir.
- Su sesión es la misma que la de un administrador, pero **no concede ningún permiso administrativo**: el servidor responde `404` a cualquier ruta de
  configuración (también si teclea la dirección) y a cualquier otro negocio. Si se le retira la asignación, se deshabilita Turnos o se pausa el negocio, su
  siguiente petición se rechaza y la pantalla lo dice («Necesitas una asignación vigente»).
## Dependencias entre módulos (anotadas como pide `arquitectura.md`)
- `business-access` (por su `index.ts`): la sesión (`adminAccessStore.ensureSession`, `withToken`, `businesses`, `leave`), `AccessError` y los tipos.
- `businesses` (por su `index.ts`): `categoryLabel` para mostrar la categoría del negocio.
- `business-setup` enlaza aquí desde la tarjeta de Turnos y `business-access` desde «Ver mis filas», sin importar este módulo.
## Notas
- Los textos de error del servidor van en inglés; `messages.ts` los traduce, y `validation.ts` repite las reglas para avisar al escribir (el servidor decide).
- El cliente llama a `/api/turnos` (proxy de Vite que quita el prefijo; `VITE_TURNOS_API_URL` en otros entornos).
- Las animaciones de la referencia (`nt-enter`, `nt-ticket`, `nt-check`) se reproducen al entrar a cada paso y se apagan con `prefers-reduced-motion`.
- No hay pruebas automáticas del frontend (como el resto de módulos); se verificó a mano en el navegador contra el backend real.
## Estructura
```
turnos/
├── index.ts                         Puerta pública: la ruta
├── api/turnosApi.ts                 /api/turnos, con errores por campo y código estable
├── stores/turnos.store.ts           Configuración del administrador (MobX): estado, borrador de reglas, pasos
├── stores/operator.store.ts         Vista del operador
├── validation.ts  messages.ts       Reglas espejo del servidor y traducción de sus mensajes
├── types.ts
├── pages/TurnosPage.tsx             Marco, pasos, navegación, cambio de negocio y vista del operador
├── components/                      ProfilePanel, QueuesPanel, RulesPanel, OperatorsPanel, ReviewPanel y sus diálogos
└── styles/turnos.css                Estilos de la referencia (prefijo `nt-`)
```

## Operación (`/business/app/:businessId/turnos/:section/:id`)
Referencia `necto-dashboard-turnos` (sin sus controles de demostración). Es la misma sesión de `business-access`; las vistas y filas de cada persona las dice el servidor y se leen en cada petición.
| Sección | Quién | Qué hace |
|---------|-------|----------|
| `dashboard` (Inicio) | operador con `home` · administrador | Atendiendo ahora, espera, emitidos, satisfacción, pulso de filas, volumen por hora, equipo y actividad, contados de turnos reales. |
| `tickets` (Mis turnos) | `my-turns` · administrador | Lista con búsqueda, filtros y paginación que resuelve el servidor; detalle con historial y cancelar. |
| `create` / `created/:id` | `create-turn` · administrador | Elegir fila, datos del cliente y campos adicionales de la fila; `clientRequestId` evita turnos dobles. |
| `queues` / `board/:id` | `queues` · administrador | Estado de cada fila; tablero esperando / atendiendo / listos con llamar, completar y «no asistió». El administrador crea, edita, pausa y elimina filas. |
| `surveys` | `surveys` · administrador | Satisfacción real (sin respuestas, «—»); el administrador configura la encuesta. |
| `team` · `display` | solo administrador | Operadores (vistas, filas, estado) y pantalla de sala. |
- **En vivo:** `operation.store` abre el canal SSE con `fetch` y el token; cada evento vuelve a leer lo que muestra la pantalla. `access.updated` relee vistas y filas; `access.revoked` cierra la pantalla con un aviso.
- Una sección sin permiso muestra «Un espacio a tu medida» (el servidor además la rechaza). El administrador también atiende, con su propia identidad.
