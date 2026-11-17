# Módulo business-access (frontend)

El acceso de los **administradores de negocio**: la persona asignada como jefe de un negocio entra con **su correo y un código de un
solo uso** que recibe por correo, sin contraseña. El diseño sale de la referencia `necto-login-admin` (carpeta `referencias html/`,
ignorada por git), **sin** sus controles de demostración (la barra "VISTA PREVIA", el código fijo `123456`, las sesiones ficticias y
"Probar mi próximo acceso"). Todo lo que decide el acceso lo decide el servidor (`necto-api`, ver su README).

## Ruta

| Ruta | Pantalla |
|------|----------|
| `/business/access` | Acceso de administradores. Es la dirección del enlace del correo (`PUBLIC_APP_URL` en el backend); un `?business=` viejo se ignora. |

Es **pública**: no pasa por la puerta del superadmin. Enlace cruzado: "Soy superadministrador ↗" lleva a `/super/login`.

## Las cinco pantallas

El estado vive en un store (`stores/adminAccess.store.ts`); la dirección no cambia entre pantallas.

1. **Correo** (`EmailStep`): el correo asignado al negocio. Si el correo **no es jefe de ningún negocio activo**, la pantalla **no avanza** al
   código y dice: "Este correo todavía no está asignado a ningún negocio. Primero el superadministrador debe invitarte a un negocio."
   (el servidor responde `404 email-not-assigned`; esto revela si un correo está asignado, ver el README del servicio).
2. **Código** (`CodeStep`): seis dígitos, vence en 10 minutos, 5 intentos por código y "Reenviar en 01:00". El servidor no dice *por qué*
   falla un código (errado, vencido, usado y bloqueado dan la misma respuesta), así que la página lleva su propia cuenta de los 5 intentos
   y su propio reloj del código que pidió; el servidor sigue siendo quien decide. Incluye **"Recordar este dispositivo"**, desactivado
   por defecto (hasta 30 días).
3. **Regreso** (`ReturnStep`): si este navegador ya tiene una sesión vigente, ofrece continuar **sin otro código**
   ("Continuar con mi sesión"). "Usar otra cuenta" y "Olvidar este dispositivo" terminan esa sesión en el servidor.
4. **Negocios** (`BusinessPicker`): solo si administra más de uno; muestra únicamente los que el servidor autorizó.
5. **Listo** (`ReadyStep`): el negocio elegido, su categoría y los módulos habilitados. Aún **no** opera los módulos.

## Sesión y seguridad

- La sesión es una **cookie `HttpOnly`** que pone el servidor: el código de la página no puede leerla (`document.cookie` sale vacío) y
  el navegador no guarda nada en `localStorage`/`sessionStorage`. El `accessToken` (10 minutos) vive **solo en memoria**.
- Al recargar la página, el store pregunta al servidor (`GET /session`) si la cookie sigue valiendo: si sí, "Regreso"; si no, "Correo".
- Si el token vence mientras la persona está en la pantalla, la siguiente llamada lo renueva una vez desde la cookie; si la sesión terminó,
  vuelve al correo con un aviso ("Tu sesión terminó…").
- Cerrar sesión (y olvidar el dispositivo) llama a `DELETE /session`: si el servidor no responde, la página **no finge** haber cerrado
  sesión, muestra el error.
- La sesión del administrador es **distinta** de la del superadmin; no comparten token ni almacén.

## Comportamientos a tener en cuenta

- El texto del paso del código dice "Pedimos el envío…", nunca que el correo llegó: solo sabemos que se pidió el envío (el proveedor puede
  aceptarlo o fallar, y eso no llega a esta pantalla).
- El superadmin puede entregar un **código temporal** (ficha del negocio → Equipo): el jefe entra por esta misma pantalla y lo escribe como
  cualquier código; mientras espera, pedir otro código no lo reemplaza.
- Los textos de error del servidor van en inglés; la página muestra los suyos en español.
- La referencia navega con `#hash` por pantalla; aquí no (el botón "atrás" del navegador sale de la página).
- Las rutas del cliente empiezan por `/business-access/...` porque el proxy de Vite (`/api/business-access`) quita su propio prefijo.

## Estructura

```
business-access/
├── index.ts                         Puerta pública: la ruta
├── api/businessAccessApi.ts         /api/business-access (VITE_BUSINESS_ACCESS_API_URL en otros entornos), con credenciales
├── stores/adminAccess.store.ts      Estado del flujo (MobX)
├── pages/BusinessAccessPage.tsx     Marco de dos columnas
├── components/                      EmailStep, CodeStep, ReturnStep, BusinessPicker, ReadyStep, BrandPanel, HelpDialog
├── hooks/                           useTick (cuentas atrás) y useFocusHeading
└── styles/business-access.css       Prefijo `na-`, claro y oscuro (de la referencia)
```

## Dependencias

- **Otro módulo**, solo por su puerta pública: `businesses` (`categoryLabel` y `moduleInfo`, para mostrar la categoría y los nombres de los
  módulos). `businesses` no importa a `business-access`: no hay ciclo.
- **Elements:** `Input` y `Label` (el correo). El campo del código, el selector de negocios y las casillas son propios, como en la referencia.
- **Base común:** `brand/NectoLogo`, `ThemeIconButton`, `PageMeta`. **Fuente:** DM Sans, cargada solo con este módulo.
