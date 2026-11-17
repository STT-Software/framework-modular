/** "Casa Oliva" -> "CO"; one word -> its first two letters. */
export function businessInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words.slice(0, 2).map((word) => word[0]).join("") : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase();
}
