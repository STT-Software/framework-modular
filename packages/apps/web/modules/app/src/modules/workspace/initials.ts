/** Initials for the avatar: "admin.root" -> "AR", "oscar" -> "OS". With no name, "SA" (super admin). */
export function initialsOf(username: string | undefined): string {
  const parts = (username ?? "").split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) return "SA";
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  return letters.toUpperCase();
}
