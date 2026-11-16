export type SceneId = "logo" | "connect" | "share" | "grow";

export interface SequenceItem {
  id: SceneId;
  /** Milisegundos que dura cada beat en pantalla (15 000 ms en flujo continuo). */
  duration: number;
  /** Texto accesible para lectores de pantalla al entrar en cada acto. */
  announce: string;
}

/** Secuencia continua de lanzamiento Necto IA ("Intelligence in motion"). */
export const SEQUENCE: readonly SequenceItem[] = [
  { id: "logo", duration: 3500, announce: "WhatsApp multiformato. Un mensaje, mil formas, un solo hilo." },
  { id: "connect", duration: 3900, announce: "Necto IA contextual. La IA lee y enruta cada intención al instante." },
  { id: "share", duration: 4000, announce: "Ecosistema modular. Pedidos, Agendamiento, Reservas, Inventarios, Turnos y Referidos conectados." },
  { id: "grow", duration: 3600, announce: "Necto IA. Inteligencia en marcha. Conecta clientes, módulos y decisiones." },
];

export const READY_ANNOUNCEMENT = "Qué bueno que estés aquí. Tu plataforma modular con Necto IA te espera.";
