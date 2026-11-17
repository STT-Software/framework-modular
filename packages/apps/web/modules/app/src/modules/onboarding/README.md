# Onboarding

Flujo posterior al inicio de sesión (`/welcome`): secuencia motion graphic continua de lanzamiento de **Necto IA** («Intelligence in motion») y registro progresivo de perfil.

## Qué ve la persona al iniciar sesión

El inicio de sesión lleva a `/welcome` (`OnboardingPage`), que decide:

- **Usuario nuevo (primera vez):** la intro animada (abajo), una sola vez por cuenta y en cualquier dispositivo. Lo
  decide el servicio: `GET /onboarding/profile/me` trae `introSeen` (ya la vio, o ya completó el perfil) y la intro se
  marca vista al empezar con `PUT /onboarding/profile/intro-seen`, así que recargar a la mitad o entrar desde otro
  equipo no la repite. Este navegador además lo recuerda (`introSeen.ts`, `localStorage` `necto:intro-seen:<id>`) para
  ir directo a la pantalla de carga sin esperar al servicio. Después siguen el registro del perfil y el cierre Ready.
- **Todas las demás veces:** la pantalla de carga «El cruce» (`WorkspaceLoader`). Mientras se anima consulta el perfil
  y descarga el workspace, y al terminar entra al workspace (o al paso 1 si el perfil sigue incompleto o no se pudo
  consultar).

Solo cuando la intro aún no se vio hay que esperar el perfil para decidir; mientras tanto se ve el fondo de la
bienvenida.

## Secuencia continua (`/welcome`, 15 s)

Un único lienzo (`LaunchSequence`) que nunca se desmonta y una **sola línea de tiempo** con la Web Animations API
(sin librerías): cada paso se programa con su retraso absoluto desde el montaje, derivado de `SEQUENCE`. Cuenta
una historia concreta del producto, con continuidad entre actos (lo que sale de un acto es lo que entra al siguiente):

1. **`logo` (3.5 s) · Un mensaje. Mil formas.** Llegan tres mensajes de WhatsApp (texto, nota de voz con onda
   animada e imagen) y un indicador de escritura.
2. **`connect` (3.9 s) · La IA lee y enruta.** Un barrido de escaneo pasa por los mensajes y cada uno recibe su
   etiqueta de intención (*Pedido*, *Agendamiento*, *Reserva*); el mensaje de la foto pide mesa y pastel y recibe dos
   (*Reserva* y *Pedido*): un mismo mensaje va a dos módulos. Los mensajes se disuelven y las etiquetas entran al
   núcleo **N**.
3. **`share` (4.0 s) · Seis motores.** Cortinilla naranja en el ángulo de la diagonal de la N; el núcleo toma
   impulso y conecta los seis módulos uno a uno, alternando izquierda y derecha: emite una onda, una chispa recorre el
   conector mientras se dibuja y la tarjeta se acopla con rebote en la punta, con su puerto encendiéndose. Con los
   seis conectados, los datos fluyen por los conectores.
4. **`grow` (3.6 s) · Nos cruzamos. Nos unimos. Crecemos.** (lema de la marca) Cortinilla índigo; los módulos vuelven al núcleo y la N se desplaza
   para formar el **logotipo completo** (letras en cascada, lema, subrayado y un brillo recortado a las letras).
   Al terminar, quien no completó su perfil pasa al paso 1 (`/welcome/phone`).
5. **Perfil**: `/welcome/phone` (teléfono) y `/welcome/source` (dónde nos conociste). Al guardar el paso 2 se
   muestra "¡Listo!" un momento y se pasa al cierre.
6. **Ready (`/welcome/ready`, `ReadyPage` + `ReadyScene`)**: la cortinilla índigo se retira en diagonal; aparece la N
   en su recuadro, el recuadro se abre y de la N brotan las letras y el lema hasta quedar el logotipo completo
   («necto grow together»); después entra «Todo listo. Crezcamos juntos.» y **Ir a mi workspace →** lleva al workspace. Con el perfil sin completar
   vuelve al paso 1. Con movimiento reducido se muestra directamente el logotipo completo.

**Geometría de marca (`BrandGeometry`).** El lenguaje de los aros del login (`DecorativeCircles`) y del motivo de la
barra lateral del workspace, no del logotipo: primitivas planas de trazo grueso, cortadas por los bordes, asimétricas
y con mucho aire, y un solo acento de color por acto. Una capa a pantalla completa mantiene las piezas y las
recompone; cada acto suma formas de su parte de la historia: onda de voz y tres puntos de "escribiendo" (mensajes),
un arco que barre como un radar y un + (la IA lee), un cuadrado redondeado que releva a la cápsula y un cuarto de
círculo en la esquina (módulos, sobre naranja en blanco rebajado), y en el cierre el cuadrado se vuelve círculo, el aro
pequeño toma el naranja y entran barras con el ángulo de la diagonal de la N. En Ready las formas se vuelven un juego
(`GeometryPlayground`): flotan por la pantalla y rebotan en los bordes; al hacerles clic salen disparadas girando
con una ráfaga de chispas, y solo la forma disparada elimina: si golpea a otra, la golpeada estalla (y vuelve a entrar, escalonada, desde algún borde) y la disparada rebota y se desvía; a la deriva solo rebotan (física propia en `requestAnimationFrame`, solo
`transform`; quietas con movimiento reducido). Cada pieza se mueve con su propio peso; todas pintan con `currentColor` y solo
se animan transform, opacidad y color.

Reglas de diseño: plano 2D, sin grillas de fondo ni adornos fuera de la geometría de marca; DM Sans 300/400/700; paleta `#FF3F1A`,
`#190088`, `#100548`, `#97D6DF`, `#F5EFE3`. Un solo vocabulario de curvas (salida tipo *expo*, entradas con rebote
leve, transiciones *in-out*). El texto de cada acto entra línea por línea con máscara **después** de que salga el
anterior (nunca se solapan). Funciona en tema claro y oscuro (`--ob-finale` es el color del cierre) y en móvil (el
gráfico pasa debajo del texto).

`OnboardingHeader` mantiene visibles el logotipo y el selector de tema adaptando sus colores a cada
acto; `StoryProgress` sincroniza los 4 tramos con `sequence.ts`.

**Pantalla de carga hacia el workspace (`WorkspaceLoader`, «El cruce»).** Aparece al pulsar **Ir a mi workspace** y en
cada inicio de sesión (salvo el de la intro). Cuenta el
lema de la marca («Nos cruzamos, nos unimos, crecemos»; NECTO viene de *nectere*, «unir») con la imagen de la
campaña, un paso de cebra visto desde arriba:

1. **Nos cruzamos.** Una cortinilla marina entra en diagonal y franjas crema, con el ángulo de la diagonal de la N,
   llegan desde arriba y desde abajo, se cruzan y forman el paso de cebra.
2. **Nos unimos.** El paso se cierra hacia el centro y sale la N; la esquina de la marca llega girando, se acopla y
   resuena en ondas.
3. **Crecemos.** Una barra crece mientras el workspace se descarga de verdad en segundo plano
   (`preloadWorkspacePage`, del módulo workspace).

Dura un mínimo de unos 3 s (y como mucho espera 8 s la descarga). Sale con una cortinilla del color del workspace,
así que no se ve un corte al entrar. Cuando la cortinilla tapa la pantalla final, el juego de formas se desmonta.
Solo anima transform y opacidad de elementos HTML. Con movimiento reducido se ve la marca quieta y se entra en cuanto
el workspace está listo.

## Contratos clave

- `useWelcomeSequence(active)`: avanza por las escenas de la intro con un temporizador mientras está activa.
- `LaunchSequence`: único lienzo con una sola línea de tiempo.
- No hay botón para saltar la intro.
- Con `prefers-reduced-motion: reduce` no hay intro (se va directo al paso 1) y la pantalla de carga se ve quieta.

## Rendimiento

La bienvenida debe ir fluida en teléfonos modestos y no calentar el equipo:

- Nada se anima en bucle infinito. Cada bucle de la secuencia (onda de voz, "escribiendo", flujo de datos) termina
  cuando su pieza deja de verse (`loopUntil` en `LaunchSequence`).
- Lo que se anima dentro del SVG se repinta en el hilo principal. Los movimientos lentos de todo el gráfico (los
  acercamientos) van en la capa HTML que lo envuelve (`.ob-launch-visual`), que compone la GPU.
- Las cortinillas miden lo justo para cubrir la pantalla inclinada (100vw + 40vh), sin `will-change` permanente, y
  la naranja se oculta cuando la marina ya la cubre.
- `GeometryPlayground` usa ~30 fps mientras las formas solo flotan. Tras unos segundos sin interacción frenan y el
  bucle se detiene hasta la próxima interacción, y con la pestaña oculta también se detiene.
- `isLowPowerDevice()` (`hooks/motionBudget.ts`) detecta equipos modestos o con ahorro de datos: sin adornos en
  bucle, sin acercamientos ni brillo final, el juego siempre a ~30 fps, con reposo más temprano y menos chispas.
