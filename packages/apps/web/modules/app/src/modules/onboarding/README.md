# Módulo onboarding (frontend)

Lo que ve el SuperAdmin **justo después de iniciar sesión**: una bienvenida animada y dos pasos de
perfil, **teléfono** y **dónde nos conoció**. Los datos se guardan en el servicio
[`onboarding`](../../../../../../services/onboarding/README.md), asociados al id de la persona.

El diseño sale de las referencias visuales `necto-onboardingBienvenida`, `necto-telefono` y `necto-origen`
(viven solo en la máquina de quien las tiene: `referencias html/`, ignorada por git). Se quitó lo que era
propio del prototipo: los botones **Omitir** y **Pausar**, y los enlaces "Volver a ver", "Volver al acceso" y el
"Volver" del paso 1 hacia la bienvenida.

## Rutas

| Ruta | Pantalla |
|------|----------|
| `/welcome` | Bienvenida animada (~11 s) y pantalla final con el botón **Comenzar**. Si el perfil ya está completo, solo la primera escena y entra a la app (ver abajo). |
| `/welcome/phone` | Paso 1 de 2: país y número de teléfono. |
| `/welcome/source` | Paso 2 de 2: dónde nos conociste (selección múltiple). |

Todas exigen sesión de SuperAdmin: sin sesión llevan a `/super/login`.

Flujo: `/super/login` → `/welcome` → **Comenzar** → `/welcome/phone` → **Continuar** → `/welcome/source` →
**Finalizar** → "¡Listo! Gracias por contarnos." → `/`.

Reglas del flujo (se deciden con el perfil guardado en el servicio, no con el navegador):

- **Perfil ya completo:** la bienvenida muestra **solo la primera escena** (el logo, "Todo empieza con una conexión.",
  2,6 s) y entra sola a `/`, sin pasar por el resto ni por el botón Comenzar. `/welcome/phone` y `/welcome/source`
  también llevan directo a `/`.
- **Perfil sin completar:** la bienvenida se ve entera y termina en **Comenzar**.
- **Cómo se decide:** la primera escena es igual para todos y mientras suena se consulta el perfil al servicio. Si la
  consulta aún no responde cuando termina la escena, el logo se queda en pantalla hasta saberlo. Si **falla** (servicio
  caído), se trata como sin completar: se ve la animación entera y los pasos de perfil muestran su error con
  "Reintentar".
- **Teléfono guardado, perfil sin terminar:** el paso 1 aparece con el número ya escrito y se puede seguir al paso 2.
- **Sin teléfono guardado:** `/welcome/source` devuelve al paso 1.

## Qué se ve en la bienvenida

| Escena | Duración | Mensaje |
|--------|----------|---------|
| Logo | 2,6 s | "Todo empieza con una conexión." |
| 01 / Conecta | 3 s | "Encuentra tu conexión." (red de nodos) |
| 02 / Comparte | 3 s | "Tus ideas, más lejos." (tarjetas en abanico) |
| 03 / Crece | 2,8 s | "Lo construimos juntos." (arcos) |
| Final | hasta pulsar | "Qué bueno que estés aquí." + botón **Comenzar** |

Las duraciones y los textos están en `sequence.ts`. No se puede pausar ni saltar.

## Paso 1: teléfono

- Selector de país (CO, MX, ES, AR, PE, CL, EC, US; el primero es el que viene marcado) y número sin indicativo.
- Valida en el navegador con las mismas reglas del servicio (`phone.ts`): solo dígitos y separadores comunes,
  mínimo 7 dígitos y, con el indicativo, máximo 15. Se envía en formato E.164 (`+573001234567`).
- **El número no se puede repetir entre cuentas:** si el servicio responde `409`, el campo muestra
  "Este número ya está registrado con otra cuenta. Usa otro número."
- Se guarda al pulsar **Continuar** (no al final), para avisar del duplicado en el momento.

## Paso 2: dónde nos conociste

- Nueve opciones: Instagram, TikTok, Facebook, YouTube, WhatsApp, LinkedIn, Familia, Negocios y Otro.
  Se puede marcar más de una; hay que marcar al menos una.
- Al servicio se envían identificadores en inglés (`instagram`, `family`, `business`, `other`...); las etiquetas en
  español están en `sources.tsx`.
- **Finalizar** guarda y marca el perfil como completo. Tras el aviso de éxito (~1,5 s) se entra a la app.

## Estructura

```
onboarding/
├── index.ts                       Puerta pública: definición del módulo
├── sequence.ts                    Escenas de la bienvenida: duraciones y textos para lectores de pantalla
├── phone.ts                       Países, validación y formato E.164 del teléfono
├── sources.tsx                    Opciones de "dónde nos conociste" (id, etiqueta e icono)
├── serviceErrors.ts               Errores del servicio traducidos a avisos para la persona
├── pages/                         OnboardingPage (bienvenida), PhoneStepPage, SourceStepPage
├── scenes/                        LogoScene, ConnectScene, ShareScene, GrowScene, ReadyScene
├── components/                    Cabecera, progreso, logotipo, ProfileSetupLayout, ProfileGate, ThemeIconButton
├── api/onboardingApi.ts           Cliente HTTP del servicio (timeout y errores tipados)
├── stores/                        Perfil del onboarding (MobX, en memoria)
├── hooks/                         Secuencia de la bienvenida, animaciones por escena, movimiento reducido
└── styles/                        onboarding.css (bienvenida) y profile-setup.css (pasos de perfil)
```

## Comportamiento a tener en cuenta

- **Movimiento reducido** (`prefers-reduced-motion`): no hay animaciones. Con el perfil sin completar se salta directo a la
  pantalla final; con el perfil completo se entra a `/` sin mostrar nada.
- **Tema:** el botón de la cabecera usa el mismo `uiStore` que el resto de la app (claro por defecto).
- **Sesión vencida:** si el servicio responde `401`, se cierra la sesión y la puerta de acceso lleva al login.
- **Perfil en memoria:** el store recarga el perfil cada vez que se abre un paso, así no se ve el de otra cuenta si se
  cambia de usuario en la misma pestaña.
- **Accesibilidad:** al abrir cada paso el foco va al título; los errores se anuncian con `role="alert"`, el
  contador de opciones con `aria-live` y la barra de progreso tiene `role="progressbar"`.
- Si el módulo falla al cargar o al renderizar, `ModuleBoundary` lo contiene.

## Dependencias

- **Servicio:** `onboarding` (`GET /onboarding/profile/me`, `PUT /onboarding/profile/phone`, `PUT /onboarding/profile/sources`).
- **Otro módulo:** `super-admin-auth`, solo por su puerta pública (`@/modules/super-admin-auth`): usa
  `superAdminSessionStore` para obtener el token que manda al servicio y para cerrar la sesión si vence.
  A la inversa, `super-admin-auth` solo conoce la **ruta** `/welcome` (a donde navega tras el login), no su código.
- **Elements:** `Select`, `Input`, `Label`, `Button` y `Alert`, con el acabado Necto aplicado por `className`;
  no se tocó `src/elements/`. Las tarjetas de "dónde nos conociste" son `checkbox` nativos propios porque el
  `Checkbox` de Elements solo admite texto. La bienvenida animada es una composición propia (SVG, CSS y
  animaciones), igual que la referencia.
- **Base común:** `uiStore` (tema), `PageMeta`, `cn` y el campo `requiresSuperAdmin` de `AppModule`
  (la app, no el módulo, pone la puerta de acceso `RequireSuperAdmin`).
- **Fuente:** DM Sans 400/500/600 (`@fontsource/dm-sans`), cargada solo con este módulo.
- El logotipo está repetido en este módulo y en `super-admin-auth` (`NectoLogo`), a propósito, para que
  ninguno dependa del otro. Si aparece un tercer uso, conviene moverlo a un lugar común.

## Configuración

| Variable | Descripción |
|----------|-------------|
| `VITE_ONBOARDING_API_URL` | URL base del servicio. Por defecto `/api/onboarding`, que el dev server de Vite reenvía al servicio. |
| `ONBOARDING_URL` | Solo dev server: dónde corre el servicio. Por defecto `http://localhost:8081`. |
