import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { prefersReducedMotion } from "../hooks/useReducedMotion";

/*
 * Pantalla final como un pequeño juego motion graphic: las formas de la geometría de marca flotan por la pantalla y
 * rebotan contra los bordes y entre ellas; al hacerles clic (o tocarlas) salen disparadas girando, con una ráfaga de
 * chispas. Solo la forma disparada elimina: si golpea a otra, la golpeada estalla y la disparada rebota y se desvía.
 * La golpeada vuelve a entrar, escalonada, desde algún borde (recién entrada tiene un momento de gracia en el que
 * solo rebota). Dos formas a la deriva que se tocan solo rebotan.
 *
 * Física propia y mínima en `requestAnimationFrame` (sin librerías): cada forma es un círculo de colisión con masa
 * proporcional a su área. Solo se escribe `transform` (lo compone la GPU). Con movimiento reducido quedan quietas.
 */

type Kind = "ring" | "capsule" | "square" | "quarter" | "arc" | "wave" | "dots" | "plus" | "slashes" | "disc";
type Tone = "indigo" | "orange" | "cyan";

interface Piece {
  kind: Kind;
  /** Ancho en vmin. */
  size: number;
  tone: Tone;
  /** Posición inicial como fracción de la pantalla. */
  x: number;
  y: number;
}

const PIECES: Piece[] = [
  { kind: "ring", size: 13, tone: "indigo", x: 0.12, y: 0.24 },
  { kind: "capsule", size: 15, tone: "cyan", x: 0.83, y: 0.2 },
  { kind: "square", size: 9, tone: "indigo", x: 0.86, y: 0.64 },
  { kind: "quarter", size: 9, tone: "cyan", x: 0.1, y: 0.74 },
  { kind: "arc", size: 11, tone: "orange", x: 0.24, y: 0.5 },
  { kind: "wave", size: 12, tone: "indigo", x: 0.7, y: 0.86 },
  { kind: "dots", size: 9, tone: "indigo", x: 0.3, y: 0.86 },
  { kind: "plus", size: 7, tone: "orange", x: 0.93, y: 0.42 },
  { kind: "slashes", size: 8, tone: "orange", x: 0.06, y: 0.46 },
  { kind: "ring", size: 7.5, tone: "orange", x: 0.68, y: 0.3 },
  { kind: "disc", size: 6, tone: "cyan", x: 0.38, y: 0.16 },
  { kind: "disc", size: 3.4, tone: "orange", x: 0.6, y: 0.13 },
];

const SPARK_COLORS: Record<Tone, string> = { indigo: "#6250e8", orange: "#ff3f1a", cyan: "#97d6df" };

function inner(kind: Kind): ReactNode {
  switch (kind) {
    case "wave":
      return (
        <svg viewBox="0 0 120 30" fill="none">
          <path d="M6 15 C14 3 24 3 32 15 S50 27 58 15 S76 3 84 15 S102 27 114 15" />
        </svg>
      );
    case "dots":
    case "slashes":
      return (
        <>
          <b />
          <b />
          <b />
        </>
      );
    case "plus":
      return (
        <>
          <b />
          <b />
        </>
      );
    default:
      return null;
  }
}

interface Body {
  el: HTMLElement;
  tone: Tone;
  w: number;
  h: number;
  /** Radio de colisión y medio alto/ancho para los bordes. */
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  /** Deriva de crucero (px/s y °/s) a la que vuelve tras un disparo. */
  cruise: number;
  baseSpin: number;
  /** Destruida en un choque, a la espera de volver a entrar. */
  alive: boolean;
  /** Entrando desde fuera de la pantalla: los bordes aún no la contienen. */
  entering: boolean;
  /** Momento (ms) desde el que puede explotar al chocar; antes solo rebota. */
  armedAt: number;
  /** Disparada con un clic y aún rápida: es la única que puede eliminar a otras. */
  shot: boolean;
  pop?: Animation;
}

/** Tras explotar, cada forma vuelve a entrar por un borde al cabo de este tiempo, escalonadas entre sí. */
const RESPAWN_MIN = 900;
const RESPAWN_SPREAD = 1600;
const RESPAWN_GAP = 650;
/** Tiempo de gracia tras aparecer: no explota (solo rebota) para no destruirse nada más entrar. */
const GRACE = 1400;

export function GeometryPlayground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduce = prefersReducedMotion();
    let W = window.innerWidth;
    let H = window.innerHeight;
    const unit = Math.min(W, H) / 100;

    const bodies: Body[] = Array.from(root.querySelectorAll<HTMLElement>(".ob-play-piece")).map((el, i) => {
      const piece = PIECES[i];
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const heading = i * 2.39996; // ángulo áureo: direcciones repartidas sin azar
      const cruise = unit * (2.4 + (i % 4) * 0.7);
      const baseSpin = (i % 2 ? 1 : -1) * (6 + (i % 5) * 3);
      return {
        el,
        tone: piece.tone,
        w,
        h,
        r: Math.max(w, h) / 2,
        x: piece.x * W,
        y: piece.y * H,
        vx: Math.cos(heading) * cruise,
        vy: Math.sin(heading) * cruise,
        angle: (i * 47) % 360,
        spin: baseSpin,
        cruise,
        baseSpin,
        alive: true,
        entering: false,
        armedAt: performance.now() + 500 + i * 90 + 750 + GRACE,
        shot: false,
      };
    });

    const place = (b: Body) => {
      b.el.style.transform = `translate3d(${b.x - b.w / 2}px, ${b.y - b.h / 2}px, 0) rotate(${b.angle}deg)`;
    };
    bodies.forEach(place);

    // Entrada: cada forma aparece con rebote, escalonada, cuando la cortina ya se retiró.
    const entrances = bodies.map((b, i) =>
      (b.el.firstElementChild as HTMLElement).animate(
        [
          { opacity: 0, scale: "0.2" },
          { opacity: 1, scale: "1" },
        ],
        { delay: reduce ? 0 : 500 + i * 90, duration: reduce ? 1 : 750, easing: "cubic-bezier(0.34, 1.45, 0.64, 1)", fill: "backwards" },
      ),
    );
    if (reduce) return () => entrances.forEach((a) => a.cancel());

    // Zonas despejadas (el texto, el logotipo y el botón de tema de la cabecera): las formas que van a la deriva las
    // rodean (un campo suave las aparta); una forma disparada puede cruzarlas, y el campo la saca al frenar.
    const page = root.closest(".ob");
    const guarded = [root.parentElement, page?.querySelector(".ob-header-brand"), page?.querySelector(".ob-actions")].filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );
    let zones = guarded.map((el) => el.getBoundingClientRect());
    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      zones = guarded.map((el) => el.getBoundingClientRect());
    };
    const settle = window.setTimeout(onResize, 400);
    window.addEventListener("resize", onResize);

    const burst = (px: number, py: number, tone: Tone) => {
      for (let k = 0; k < 9; k++) {
        const spark = document.createElement("i");
        spark.className = "ob-play-spark";
        spark.style.left = `${px}px`;
        spark.style.top = `${py}px`;
        spark.style.background = SPARK_COLORS[tone];
        root.appendChild(spark);
        const a = (k / 9) * Math.PI * 2 + Math.random() * 0.4;
        const d = unit * (6 + Math.random() * 5);
        const duration = 560 + Math.random() * 220;
        spark.animate([{ translate: "-50% -50%" }, { translate: `calc(-50% + ${Math.cos(a) * d}px) calc(-50% + ${Math.sin(a) * d}px)` }], {
          duration,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "forwards",
        });
        spark
          .animate(
            [
              { scale: "1", opacity: 1 },
              { scale: "1", opacity: 1, offset: 0.45 },
              { scale: "0", opacity: 0 },
            ],
            { duration, easing: "ease-in" },
          )
          .finished.then(
            () => spark.remove(),
            () => spark.remove(),
          );
      }
    };

    // Explosión: la forma estalla en chispas y desaparece; vuelve a entrar más tarde por un borde.
    const timers: number[] = [];
    let nextSlot = 0;
    const respawn = (b: Body) => {
      const edge = Math.floor(Math.random() * 4);
      const along = 0.15 + Math.random() * 0.7;
      const speed = b.cruise * (5 + Math.random() * 3);
      const tilt = (Math.random() - 0.5) * 0.8;
      if (edge === 0) [b.x, b.y, b.vx, b.vy] = [along * W, -b.r, tilt * speed, speed];
      else if (edge === 1) [b.x, b.y, b.vx, b.vy] = [W + b.r, along * H, -speed, tilt * speed];
      else if (edge === 2) [b.x, b.y, b.vx, b.vy] = [along * W, H + b.r, tilt * speed, -speed];
      else [b.x, b.y, b.vx, b.vy] = [-b.r, along * H, speed, tilt * speed];
      b.spin = b.baseSpin * 6;
      b.pop?.cancel();
      b.pop = undefined;
      b.alive = true;
      b.entering = true;
      b.armedAt = performance.now() + GRACE;
      b.shot = false;
      b.el.style.pointerEvents = "";
      place(b);
    };
    const explode = (b: Body) => {
      b.alive = false;
      b.shot = false;
      b.el.style.pointerEvents = "none";
      burst(b.x, b.y, b.tone);
      b.pop = (b.el.firstElementChild as HTMLElement).animate(
        [
          { scale: "1", opacity: 1 },
          { scale: "1.45", opacity: 0.9, offset: 0.35 },
          { scale: "0", opacity: 0 },
        ],
        { duration: 340, easing: "ease-in", fill: "forwards" },
      );
      const now = performance.now();
      const at = Math.max(now + RESPAWN_MIN + Math.random() * RESPAWN_SPREAD, nextSlot);
      nextSlot = at + RESPAWN_GAP;
      timers.push(window.setTimeout(() => respawn(b), at - now));
    };

    const onPointerDown = (event: PointerEvent) => {
      const el = (event.target as Element).closest(".ob-play-piece");
      const b = bodies.find((body) => body.el === el);
      if (!b || !b.alive) return;
      event.preventDefault();
      let dx = b.x - event.clientX;
      let dy = b.y - event.clientY;
      const len = Math.hypot(dx, dy);
      if (len < 2) {
        const a = Math.random() * Math.PI * 2;
        dx = Math.cos(a);
        dy = Math.sin(a);
      } else {
        dx /= len;
        dy /= len;
      }
      const kick = Math.max(W, H) * (1.1 + Math.random() * 0.5);
      b.vx = dx * kick;
      b.vy = dy * kick;
      b.spin = (Math.random() < 0.5 ? -1 : 1) * (540 + Math.random() * 540);
      b.shot = true;
      (b.el.firstElementChild as HTMLElement).animate([{ scale: "1" }, { scale: "1.35" }, { scale: "1" }], {
        duration: 380,
        easing: "cubic-bezier(0.34, 1.45, 0.64, 1)",
      });
      burst(event.clientX, event.clientY, b.tone);
    };
    root.addEventListener("pointerdown", onPointerDown);

    let last = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      for (const b of bodies) {
        if (!b.alive) continue;
        // Roce: tras un disparo la velocidad decae hasta la deriva; si queda muy lenta, recupera la deriva.
        const speed = Math.hypot(b.vx, b.vy);
        // Al frenar deja de ser un proyectil: ya no elimina, solo rebota.
        if (b.shot && speed < b.cruise * 3) b.shot = false;
        if (speed > b.cruise) {
          const f = Math.max(b.cruise / speed, Math.exp(-1.5 * dt));
          b.vx *= f;
          b.vy *= f;
        } else if (speed < b.cruise * 0.8 && speed > 0.01) {
          const f = 1 + 0.6 * dt;
          b.vx *= f;
          b.vy *= f;
        }
        for (const zone of speed < b.cruise * 4 ? zones : []) {
          const pad = b.r * 0.7;
          if (b.x > zone.left - pad && b.x < zone.right + pad && b.y > zone.top - pad && b.y < zone.bottom + pad) {
            const cx = (zone.left + zone.right) / 2;
            const cy = (zone.top + zone.bottom) / 2;
            // Sale por el lado más cercano del rectángulo.
            const ex = (b.x - cx) / (zone.width / 2 + pad);
            const ey = (b.y - cy) / (zone.height / 2 + pad);
            const push = unit * 70 * dt;
            if (Math.abs(ex) > Math.abs(ey)) b.vx += Math.sign(ex || 1) * push;
            else b.vy += Math.sign(ey || 1) * push;
          }
        }
        b.spin = b.baseSpin + (b.spin - b.baseSpin) * Math.exp(-1.3 * dt);
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.angle += b.spin * dt;

        // Mientras entra desde fuera, los bordes no la contienen hasta que está dentro del todo.
        if (b.entering) {
          if (b.x >= b.r && b.x <= W - b.r && b.y >= b.r && b.y <= H - b.r) b.entering = false;
          continue;
        }
        if (b.x < b.r) {
          b.x = b.r;
          b.vx = Math.abs(b.vx) * 0.9;
        } else if (b.x > W - b.r) {
          b.x = W - b.r;
          b.vx = -Math.abs(b.vx) * 0.9;
        }
        if (b.y < b.r) {
          b.y = b.r;
          b.vy = Math.abs(b.vy) * 0.9;
        } else if (b.y > H - b.r) {
          b.y = H - b.r;
          b.vy = -Math.abs(b.vy) * 0.9;
        }
      }

      // Choques: siempre rebotan (choque elástico, masa proporcional al área), así que la forma que golpea se desvía.
      // Solo una forma disparada con un clic elimina: la golpeada estalla si ya está armada (si acaba de aparecer,
      // solo rebota). Dos formas a la deriva que se tocan solo rebotan.
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i];
          const c = bodies[j];
          if (!a.alive || !c.alive) continue;
          const dx = c.x - a.x;
          const dy = c.y - a.y;
          const min = (a.r + c.r) * 0.82;
          const dist = Math.hypot(dx, dy);
          if (dist >= min || dist === 0) continue;
          const nx = dx / dist;
          const ny = dy / dist;
          const ma = a.r * a.r;
          const mc = c.r * c.r;
          const overlap = min - dist;
          a.x -= nx * overlap * (mc / (ma + mc));
          a.y -= ny * overlap * (mc / (ma + mc));
          c.x += nx * overlap * (ma / (ma + mc));
          c.y += ny * overlap * (ma / (ma + mc));
          const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (rel > 0) continue;

          // Golpe: una forma disparada contra otra que no lo está y ya está armada. La golpeada estalla y la
          // disparada rebota contra ella como contra una pared (se refleja sobre la normal del choque), así que
          // siempre se desvía, aunque la golpeada sea pequeña.
          const striker = a.shot && !c.shot ? a : c.shot && !a.shot ? c : null;
          const victim = striker === a ? c : a;
          if (striker && now >= victim.armedAt) {
            const sx = striker === a ? nx : -nx;
            const sy = striker === a ? ny : -ny;
            const into = striker.vx * sx + striker.vy * sy;
            if (into > 0) {
              striker.vx -= 1.75 * into * sx;
              striker.vy -= 1.75 * into * sy;
            }
            striker.spin = -striker.spin * 1.2;
            explode(victim);
            continue;
          }

          // Si no, choque elástico (masa proporcional al área): dos formas a la deriva, o dos disparadas, rebotan.
          const impulse = (-(1 + 0.9) * rel) / (1 / ma + 1 / mc);
          a.vx -= (impulse / ma) * nx;
          a.vy -= (impulse / ma) * ny;
          c.vx += (impulse / mc) * nx;
          c.vy += (impulse / mc) * ny;
        }
      }

      bodies.forEach(place);
      frame = requestAnimationFrame(step);
    });

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("resize", onResize);
      root.removeEventListener("pointerdown", onPointerDown);
      entrances.forEach((a) => a.cancel());
    };
  }, []);

  return (
    <div ref={ref} className="ob-play" aria-hidden="true">
      {PIECES.map((piece, i) => (
        <div key={i} className="ob-play-piece">
          <div className={`ob-shape is-${piece.kind} tone-${piece.tone}`} style={{ "--size": piece.size } as CSSProperties}>
            {inner(piece.kind)}
          </div>
        </div>
      ))}
    </div>
  );
}
