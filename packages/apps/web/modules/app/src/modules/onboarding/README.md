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

## Secuencia de bienvenida (`/welcome`, 15 s)

Un único lienzo (`LaunchSequence`) que nunca se desmonta. Cada acto de `SEQUENCE` tiene su texto y su
**ilustración vectorial editorial**, con el mismo lenguaje y las mismas primitivas que `RegisterScenes`
(`/super/register`) y `BrandScenes` (`/business/access`): `ArtOrbits`, `ArtSpark`, `ArtMark` y
`ArtCheckBadge`, tarjetas con borde 1.3, íconos de trazo 1.5, enlaces punteados y sombra basal, sin degradados ni
personas. Las ilustraciones cambian con el acto (opacidad + 10 px con `cubic-bezier(0.22, 1, 0.36, 1)`, como
`.sa-scene-enter`), entrando junto con el texto (~0.6 s) cuando la cortinilla ya cubre el gráfico, y dentro de cada
una las piezas entran escalonadas con un leve rebote (`.ob-art-pop`). Después, cada escena cuenta su parte con
movimiento de causa → efecto (solo CSS, colgado de `.ob-art-scene.is-active`: al cambiar de acto todo bucle se
detiene): en el acto 0 la onda de voz suena y el play late, el contacto está en línea y escribiendo, y los satélites
flotan mientras sus datos fluyen hacia la tarjeta; en el 1 los mensajes fluyen al motor, la lupa escanea, la barra se
llena mientras la N late y cada intención sale disparada del motor por su línea (que se traza) y enciende su check; en
el 2 el núcleo late, traza un conector tras otro y cada tarjeta se acopla con rebote cuando el conector toca su puerto
(que destella) y su check aparece; con las seis conectadas, los datos fluyen por todos los conectores. Las órbitas
giran despacio y los destellos titilan. Solo se animan `translate`/`scale`/`rotate` (no pisan el `transform` de las
piezas inclinadas), opacidad y `stroke-dashoffset`; en equipos modestos (`.ob-launch.is-lite`, que incluye cualquier equipo de 4 núcleos) solo
se quitan el giro de las órbitas y el titileo de los destellos, y con movimiento reducido se ve el estado final. Las cortinillas, la geometría de marca y el
cierre siguen una línea de tiempo con la Web Animations API, derivada de `SEQUENCE`.

1. **`logo` (3.5 s) · Un mensaje. Mil formas.** Tarjeta de conversación inclinada con tres mensajes: texto
   (*Quiero 2 hamburguesas a domicilio*), nota de voz (play, onda, `0:12`) y foto (pastel sobre la mesa,
   *¿Mesa para 4 y un pastel?*); satélites de micrófono, imagen y mensaje.
2. **`connect` (3.9 s) · La IA lee y enruta.** Los tres mensajes leídos entran a la tarjeta del motor **Necto IA**
   (la N como protagonista, con una lupa encima) y salen las intenciones clasificadas con check: *Pedido* (naranja),
   *Agendamiento* (cian) y, del mismo mensaje de la foto, *Reserva* y *Pedido* a la vez.
3. **`share` (4.0 s) · Seis motores.** Sobre la cortinilla naranja, el núcleo N y las seis tarjetas de módulos
   (*Pedidos 128 hoy*, *Agendamiento 36 citas*, *Reservas 14 mesas*, *Inventarios 2.4k ítems*, *Turnos En fila: 8*,
   *Referidos +21 nuevos*) conectadas por su puerto, entrando una a una alternando izquierda y derecha.
4. **`grow` (3.6 s) · Nos cruzamos. Nos unimos. Crecemos.** (lema de la marca) Sobre la cortinilla índigo, la
   **animación del logotipo**: la N llega en su recuadro, el recuadro se abre y la N se desplaza para formar el
   **logotipo completo** (letras en cascada, lema, subrayado y un brillo recortado a las letras).
   Al terminar, quien no completó su perfil pasa al paso 1 (`/welcome/phone`).

**Colores del arte.** Solo con las clases `ob-art-*` de `onboarding.css`, que leen variables por acto y tema
(`--ob-art-paper`, `--ob-art-line`, `--ob-art-blue`, `--ob-art-cyan`, `--ob-art-accent`…): tarjetas blancas
sobre el crema y órbitas índigo (actos 0 y 1, claro), tarjetas índigo profundo sobre `#100548` (oscuro), y sobre la
cortinilla naranja tarjetas blancas (claro) o índigo profundo (oscuro) con órbitas blancas.
5. **Perfil**: `/welcome/phone` (teléfono) y `/welcome/source` (dónde nos conociste). Cada paso lleva su ilustración (`SetupArt`: `PhoneArt` y `SourceArt`) en un panel crema (índigo profundo
   en oscuro) junto al formulario, o debajo en pantallas angostas, con el mismo lenguaje y las mismas primitivas que la
   intro (`scenes/artPrimitives.tsx`): un teléfono con el campo de número y satélites de mensaje, privacidad y llamada;
   y el núcleo N con los canales a su alrededor. Las tarjetas de opciones usan ese lenguaje: borde 1.3, esquinas 14,
   glifo de línea (`SOURCE_GLYPHS`, el mismo de la ilustración) en una ficha suave que pasa a naranja al elegirla, y
   la casilla es la insignia cian con check. Las piezas entran escalonadas y sus bucles reposan a los 14 s (`ArtStage`). Al guardar el paso 2 se
   muestra "¡Listo!" un momento y se pasa al cierre.
6. **Ready (`/welcome/ready`, `ReadyPage` + `ReadyScene`)**: la cortinilla índigo se retira en diagonal; aparece la N
   en su recuadro, el recuadro se abre y de la N brotan las letras y el lema hasta quedar el logotipo completo
   («necto grow together»); a sus lados llegan lo completado (teléfono y origen) y el negocio listo (`ReadyArt`, oculto en pantallas angostas); después entra «Todo listo. Crezcamos juntos.» y **Comencemos juntos →** lleva al workspace. Con el perfil sin completar
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

**Pantalla de carga hacia el workspace (`WorkspaceLoader`, «El cruce»).** Aparece al pulsar **Comencemos juntos** y en
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
- `LaunchSequence`: único lienzo; una ilustración por acto (`sceneIndex`) y una línea de tiempo para cortinillas, geometría y cierre.
- No hay botón para saltar la intro.
- Con `prefers-reduced-motion: reduce` no hay intro (se va directo al paso 1) y la pantalla de carga se ve quieta.

## Rendimiento

La bienvenida debe ir fluida en teléfonos modestos y no calentar el equipo:

- Los bucles de las ilustraciones (onda, puntos, flujo, flotación, órbitas, destellos) solo corren en la escena
  activa; las que no se ven quedan sin animaciones y con `visibility: hidden`.
- Lo que se mueve dentro de un SVG se repinta en el hilo principal. Por eso la escena en pantalla (y la que sale)
  tiene su propia capa de composición y `.ob-launch-visual` lleva `contain`: sus repintados no arrastran al texto
  ni al fondo. El círculo punteado de las órbitas, que gira todo el acto, vive en su propia capa HTML
  (`ArtOrbitRing`) y lo rota la GPU sin repintar. Las píldoras y tarjetas que viajan llevan su centro fijo
  (`transform-box: view-box`) para no medir su caja en cada fotograma, y las ilustraciones se crean una sola vez
  (`ACT_SCENES`): al cambiar de acto React no recorre sus cientos de nodos.
- Medido con la CPU ralentizada 4× (Chrome, pantalla 2×): de 43 fps y 12 tirones en el acto 2 a 55-59 fps en todos
  los actos con un solo tirón por cambio de acto, y de 9.9 s a ~7.5 s de hilo principal ocupado en los 15 s.
- Las cortinillas miden lo justo para cubrir la pantalla inclinada (100vw + 40vh), sin `will-change` permanente, y
  la naranja se oculta cuando la marina ya la cubre.
- `GeometryPlayground` usa ~30 fps mientras las formas solo flotan. Tras unos segundos sin interacción frenan y el
  bucle se detiene hasta la próxima interacción, y con la pestaña oculta también se detiene.
- `isLowPowerDevice()` (`hooks/motionBudget.ts`) detecta equipos modestos o con ahorro de datos: sin adornos en
  bucle ni brillo final, el juego siempre a ~30 fps, con reposo más temprano y menos chispas.
