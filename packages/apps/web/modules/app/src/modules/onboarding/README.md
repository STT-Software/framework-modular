# Onboarding

Flujo posterior al inicio de sesión (`/welcome`): secuencia motion graphic continua de lanzamiento de **Necto IA** («Intelligence in motion») y registro progresivo de perfil.

## Secuencia continua (`/welcome`, 15 s)

Un único lienzo (`LaunchSequence`) que nunca se desmonta y una **sola línea de tiempo** con la Web Animations API
(sin librerías): cada paso se programa con su retraso absoluto desde el montaje, derivado de `SEQUENCE`. Cuenta
una historia concreta del producto, con continuidad entre actos (lo que sale de un acto es lo que entra al siguiente):

1. **`logo` (3.5 s) · Un mensaje. Mil formas.** Llegan tres mensajes de WhatsApp (texto, nota de voz con onda
   animada e imagen) y un indicador de escritura. Si la cuenta ya completó su perfil, de aquí va al workspace.
2. **`connect` (3.9 s) · La IA lee y enruta.** Un barrido de escaneo pasa por los mensajes y cada uno recibe su
   etiqueta de intención (*Pedido*, *Agendamiento*, *Reserva*); los mensajes se disuelven y las etiquetas entran al
   núcleo **N**.
3. **`share` (4.0 s) · Seis motores.** Cortinilla naranja en el ángulo de la diagonal de la N; el núcleo despliega
   las seis tarjetas de módulos con conectores y pulsos de datos.
4. **`grow` (3.6 s) · Inteligencia en marcha.** Cortinilla índigo; los módulos vuelven al núcleo y la N se desplaza
   para formar el **logotipo completo** (letras en cascada, lema, subrayado y un brillo recortado a las letras).
5. **Ready (`ReadyScene`)**: la cortinilla índigo se retira en diagonal y aparece **Comenzar →** hacia
   `/welcome/phone` y `/welcome/source`.

Reglas de diseño: plano 2D, sin círculos de adorno ni grillas de fondo; DM Sans 300/400/700; paleta `#FF3F1A`,
`#190088`, `#100548`, `#97D6DF`, `#F5EFE3`. Un solo vocabulario de curvas (salida tipo *expo*, entradas con rebote
leve, transiciones *in-out*). El texto de cada acto entra línea por línea con máscara **después** de que salga el
anterior (nunca se solapan). Funciona en tema claro y oscuro (`--ob-finale` es el color del cierre) y en móvil (el
gráfico pasa debajo del texto).

`OnboardingHeader` mantiene visibles el logotipo y el selector de tema adaptando sus colores a cada
acto; `StoryProgress` sincroniza los 4 tramos con `sequence.ts`.

## Contratos clave

- `useWelcomeSequence`: la escena inicial (`logo`) consulta `onboardingProfileStore.load()` en paralelo y redirige a `/workspace` si `profile.completed === true`. Devuelve `holding` mientras la primera escena terminó pero aún no se sabe si el perfil está completo.
- `LaunchSequence`: único lienzo con una sola línea de tiempo; con `holding` la congela (y la reanuda al seguir).
- Con `prefers-reduced-motion: reduce` no hay secuencia: se muestra directamente `ReadyScene` (o, con el perfil completo, se entra al workspace).
