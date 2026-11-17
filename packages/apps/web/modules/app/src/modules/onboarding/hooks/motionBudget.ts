/**
 * Presupuesto de movimiento según el equipo. En equipos modestos (pocos núcleos o poca memoria) o con ahorro de
 * datos activado, la bienvenida quita los adornos en bucle y el juego de formas corre a menos fotogramas y se
 * detiene antes. La historia y los tiempos son los mismos.
 */
interface NavigatorHints {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

export function isLowPowerDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const hints = navigator as Navigator & NavigatorHints;
  if (hints.connection?.saveData) return true;
  if (typeof hints.deviceMemory === "number" && hints.deviceMemory <= 4) return true;
  if (typeof hints.hardwareConcurrency === "number" && hints.hardwareConcurrency <= 4) return true;
  return false;
}
