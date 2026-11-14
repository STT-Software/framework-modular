/**
 * A spreadsheet runs a cell that starts with these characters as a formula. A business name like
 * `=HYPERLINK(...)` typed by a user would execute when the exported file is opened, so such cells are
 * prefixed with an apostrophe, which makes the spreadsheet read them as text.
 */
const FORMULA_STARTS = new Set(['=', '+', '-', '@', '\t', '\r']);

export function neutralizeFormula(value: string): string {
  return value !== '' && FORMULA_STARTS.has(value[0]) ? `'${value}` : value;
}

function escapeCell(value: string): string {
  const safe = neutralizeFormula(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Builds a CSV text (CRLF lines, UTF-8 BOM so spreadsheets read accents correctly). */
export function toCsv(header: readonly string[], rows: ReadonlyArray<readonly string[]>): string {
  return '\uFEFF' + [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}
