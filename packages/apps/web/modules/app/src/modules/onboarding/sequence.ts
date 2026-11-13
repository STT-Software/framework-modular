export type SceneId = "logo" | "connect" | "share" | "grow";

export interface SequenceItem {
  id: SceneId;
  /** Milisegundos que se queda la escena en pantalla. */
  duration: number;
  /** Texto que leen los lectores de pantalla al entrar a la escena. */
  announce: string;
}

/** Escenas de la bienvenida, en orden. Al terminar sigue la pantalla final ("ready"). */
export const SEQUENCE: readonly SequenceItem[] = [
  { id: "logo", duration: 2600, announce: "Necto. Todo empieza con una conexión." },
  { id: "connect", duration: 3000, announce: "Conecta. Encuentra tu conexión." },
  { id: "share", duration: 3000, announce: "Comparte. Tus ideas, más lejos." },
  { id: "grow", duration: 2800, announce: "Crece. Lo construimos juntos." },
];

export const READY_ANNOUNCEMENT = "Qué bueno que estés aquí. Tu próxima conexión te espera.";
