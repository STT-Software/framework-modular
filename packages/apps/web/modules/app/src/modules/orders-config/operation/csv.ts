export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function escapeCsvField(value: string | number): string {
  const text = String(value ?? "");
  const s = typeof value === "string" && /^[=+@\-\t\r]/.test(text) ? "'" + text : text;
  const needsQuotes = /[",\r\n]/.test(s);
  if (!needsQuotes) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvField).join(","),
  );
  return lines.join("\r\n");
}
export const BOM_UTF8 = "\uFEFF";

export function downloadCsv(content: string, filename: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([BOM_UTF8 + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
