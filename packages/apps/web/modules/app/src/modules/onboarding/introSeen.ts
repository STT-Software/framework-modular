/**
 * Recuerda, por cuenta y en este navegador, que la intro animada ya se mostró: se ve una sola vez.
 * Si el almacenamiento no está disponible (modo privado, bloqueado), se trata como no vista.
 */
const key = (accountId: string) => `necto:intro-seen:${accountId}`;

export function hasSeenIntro(accountId: string): boolean {
  try {
    return localStorage.getItem(key(accountId)) === "1";
  } catch {
    return false;
  }
}

export function markIntroSeen(accountId: string): void {
  try {
    localStorage.setItem(key(accountId), "1");
  } catch {
    /* Sin almacenamiento: la intro podría volver a verse, nada más. */
  }
}
