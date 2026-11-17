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
  { id: "connect", duration: 3900, announce: "Necto IA contextual. La IA lee y enruta cada intención; si un mensaje pide dos cosas, cada una llega a su módulo." },
  { id: "share", duration: 4000, announce: "Ecosistema modular. Pedidos, Agendamiento, Reservas, Inventarios, Turnos y Referidos conectados." },
  { id: "grow", duration: 3600, announce: "Necto. Nos cruzamos, nos unimos, crecemos." },
];

export const READY_ANNOUNCEMENT = "Todo listo. Crezcamos juntos.";
