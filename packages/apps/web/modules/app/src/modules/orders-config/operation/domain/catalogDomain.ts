export interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  gallery?: string[];
  variants?: string[];
  available: boolean;
  createdAt: string;
}

export type Product = CatalogProduct;

export interface CatalogFileEntry {
  id: string;
  name: string;
  dataUrl: string;
  folder: string;
  sizeBytes: number;
  addedAt: string;
}

export interface CatalogCategoryMeta {
  id: string;
  label: string;
  iconKey: string;
}

export const CATALOG_CATEGORY_META: ReadonlyArray<CatalogCategoryMeta> = [
  {
    id: "salud-belleza",
    label: "Salud, belleza y cuidado personal",
    iconKey: "heart",
  },
  {
    id: "hogar-cocina",
    label: "Hogar, Muebles, Cocina",
    iconKey: "home",
  },
  {
    id: "tecnologia",
    label: "Tecnología y electrodomésticos",
    iconKey: "bolt",
  },
  {
    id: "moda-ropa",
    label: "Moda, Ropa y Accesorios",
    iconKey: "shopping-bag",
  },
  {
    id: "bebes-juguetes",
    label: "Bebés, Juguetes y Juegos",
    iconKey: "gift",
  },
  {
    id: "animales-mascotas",
    label: "Animales y Mascotas",
    iconKey: "sparkles",
  },
  {
    id: "deportes-fitness",
    label: "Deportes y Fitness",
    iconKey: "fire",
  },
  {
    id: "vehiculos",
    label: "Vehículos",
    iconKey: "truck",
  },
  {
    id: "libreria-papeleria",
    label: "Librería y papelería",
    iconKey: "book",
  },
  {
    id: "herramientas",
    label: "Herramientas",
    iconKey: "wrench",
  },
  {
    id: "otros",
    label: "Otros",
    iconKey: "squares",
  },
];

export const CATALOG_CATEGORIES: readonly string[] = CATALOG_CATEGORY_META.map(
  (item) => item.label,
);

interface VisualPalette {
  bgStart: string;
  bgEnd: string;
  accent: string;
  glyph: string;
}

const CATEGORY_PALETTES: Record<string, VisualPalette> = {
  "salud, belleza y cuidado personal": {
    bgStart: "#FFE4E6",
    bgEnd: "#FECDD3",
    accent: "#E11D48",
    glyph: "M24 35s-11-6.8-11-14a6.5 6.5 0 0 1 11-4.6A6.5 6.5 0 0 1 35 21c0 7.2-11 14-11 14z",
  },
  "hogar, muebles, cocina": {
    bgStart: "#DCFCE7",
    bgEnd: "#BBF7D0",
    accent: "#15803D",
    glyph: "M24 12l13 11h-3v13H14V23h-3l13-11z",
  },
  "tecnologia y electrodomesticos": {
    bgStart: "#DBEAFE",
    bgEnd: "#BFDBFE",
    accent: "#1D4ED8",
    glyph: "M13 15h22v15H13V15zm6 18h10v3H19v-3z",
  },
  "moda, ropa y accesorios": {
    bgStart: "#EDE9FE",
    bgEnd: "#DDD6FE",
    accent: "#7C3AED",
    glyph: "M18 13l6 4 6-4 7 6-4 5-3-2v14H18V22l-3 2-4-5 7-6z",
  },
  "bebes, juguetes y juegos": {
    bgStart: "#FEF3C7",
    bgEnd: "#FDE68A",
    accent: "#D97706",
    glyph: "M15 20h18v15H15V20zm-2-5h22v4H13v-4zm11-4a3 3 0 0 1 3 3h-6a3 3 0 0 1 3-3z",
  },
  "animales y mascotas": {
    bgStart: "#FFEDD5",
    bgEnd: "#FED7AA",
    accent: "#EA580C",
    glyph: "M17 19a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6zm14 0a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6zm-7-2a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6zm0 4c4.5 0 8 3.2 8 7 0 2.5-1.8 4-4.5 4-1.5 0-2.5-.5-3.5-.5s-2 .5-3.5.5C17.8 32 16 30.5 16 28c0-3.8 3.5-7 8-7z",
  },
  "deportes y fitness": {
    bgStart: "#CCFBF1",
    bgEnd: "#99F6E4",
    accent: "#0F766E",
    glyph: "M11 20h4v8h-4v-8zm5-3h3v14h-3V17zm13 0h3v14h-3V17zm4 3h4v8h-4v-8zm-14 2h10v4H19v-4z",
  },
  vehiculos: {
    bgStart: "#E0E7FF",
    bgEnd: "#C7D2FE",
    accent: "#4338CA",
    glyph: "M14 20l3-6h14l3 6h2v10h-3a3 3 0 1 1-6 0h-6a3 3 0 1 1-6 0h-3V20h2z",
  },
  "libreria y papeleria": {
    bgStart: "#FCE7F3",
    bgEnd: "#FBCFE8",
    accent: "#BE185D",
    glyph: "M14 13h17a3 3 0 0 1 3 3v19H17a3 3 0 0 0-3 3V13zm4 5v2h12v-2H18zm0 5v2h12v-2H18z",
  },
  herramientas: {
    bgStart: "#E0F2FE",
    bgEnd: "#BAE6FD",
    accent: "#0369A1",
    glyph: "M29 13a6 6 0 0 0-5.4 8.6L14 31.2l2.8 2.8 9.6-9.6A6 6 0 1 0 29 13z",
  },
  gastronomia: {
    bgStart: "#FFEDD5",
    bgEnd: "#FED7AA",
    accent: "#C2410C",
    glyph: "M15 13h2v10a3 3 0 0 0 2 2.8V35h2v-9.2a3 3 0 0 0 2-2.8V13h-2v8h-1v-8h-2v8h-1v-8h-2zm15 0c-2.2 0-4 2.2-4 5v5h3v12h3V13h-2z",
  },
  servicios: {
    bgStart: "#E0E7FF",
    bgEnd: "#C7D2FE",
    accent: "#4F46E5",
    glyph: "M24 12l2.8 7.2L34 22l-7.2 2.8L24 32l-2.8-7.2L14 22l7.2-2.8L24 12z",
  },
  otros: {
    bgStart: "#F1F5F9",
    bgEnd: "#E2E8F0",
    accent: "#334155",
    glyph: "M14 14h9v9h-9v-9zm11 0h9v9h-9v-9zM14 25h9v9h-9v-9zm11 0h9v9h-9v-9z",
  },
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveCategoryKey(name: string, category: string): string {
  const normalizedCategory = normalizeText(category);
  if (normalizedCategory && CATEGORY_PALETTES[normalizedCategory]) {
    return normalizedCategory;
  }

  const combined = `${normalizeText(name)} ${normalizedCategory}`;
  if (
    /(pizza|hamburguesa|pasta|arroz|arroces|bebida|limonada|jugo|postre|cheesecake|brownie|entrada|ensalada|comida|menu|alimento|parrilla|plato|wok|pollo|carne|taco|sushi|cafe|panaderia)/.test(
      combined,
    )
  ) {
    return "gastronomia";
  }
  if (
    /(estilismo|spa|bienestar|masaje|asesoria|mantenimiento|servicio|sesion|limpieza facial|corte|peinado|confeccion|ajuste|reparacion|consultoria|colorimetria)/.test(
      combined,
    )
  ) {
    return "servicios";
  }
  if (
    /(crema|serum|protector|perfume|shampoo|facial|belleza|salud|cuidado|maquillaje|vitamina|cosmet|skincare)/.test(
      combined,
    )
  ) {
    return "salud, belleza y cuidado personal";
  }
  if (
    /(lampara|silla|cafetera|termo|organizador|mesa|cocina|hogar|mueble|colchon|almohada|olla|vajilla|decoracion)/.test(
      combined,
    )
  ) {
    return "hogar, muebles, cocina";
  }
  if (
    /(audifono|teclado|mouse|cargador|celular|laptop|parlante|tecnolog|electrodomest|tablet|monitor|smartwatch|licuadora|freidora|airfryer)/.test(
      combined,
    )
  ) {
    return "tecnologia y electrodomesticos";
  }
  if (
    /(chaqueta|camiseta|camisa|pantalon|jean|vestido|hoodie|buzo|ropa|moda|tenis|zapato|bota|sandalia|calzado|gorra|bolso|morral|reloj|gafas|billetera|accesorio)/.test(
      combined,
    )
  ) {
    return "moda, ropa y accesorios";
  }
  if (
    /(bebe|juguete|juego|panal|coche|muneca|lego|rompecabezas|infantil|didactico|peluche)/.test(
      combined,
    )
  ) {
    return "bebes, juguetes y juegos";
  }
  if (
    /(mascota|perro|gato|animal|concentrado|arnes|correa|cama mascota|arena|rascador|collar)/.test(
      combined,
    )
  ) {
    return "animales y mascotas";
  }
  if (
    /(deporte|fitness|mancuerna|yoga|colchoneta|bicicleta|balon|proteina|gimnasio|running|banda elastica|pesas)/.test(
      combined,
    )
  ) {
    return "deportes y fitness";
  }
  if (
    /(vehiculo|carro|moto|casco|llanta|aceite motor|repuesto|guantes moto|auto|camioneta|bateria carro)/.test(
      combined,
    )
  ) {
    return "vehiculos";
  }
  if (
    /(libro|libreria|papeleria|cuaderno|agenda|esfero|marcador|lapiz|carpeta|resma|novela|escolar)/.test(
      combined,
    )
  ) {
    return "libreria y papeleria";
  }
  if (
    /(herramienta|taladro|destornillador|martillo|llave inglesa|sierra|pulidora|ferreteria|alicate|cinta metrica)/.test(
      combined,
    )
  ) {
    return "herramientas";
  }
  return "otros";
}

function canonicalCategoryLabel(raw: string, productName: string): string {
  const normalized = normalizeText(raw);
  const direct = CATALOG_CATEGORIES.find(
    (category) => normalizeText(category) === normalized,
  );
  if (direct) return direct;

  const inferredKey = resolveCategoryKey(productName, raw);
  return (
    CATALOG_CATEGORIES.find(
      (category) => normalizeText(category) === inferredKey,
    ) ?? "Otros"
  );
}

/**
 * Generates an offline-safe, color-coded SVG product card data URL matched
 * to the product's keywords or category so catalog images never 404.
 */
export function assignSmartPhoto(name: string, category: string): string {
  const key = resolveCategoryKey(name, category);
  const palette = CATEGORY_PALETTES[key] ?? CATEGORY_PALETTES.otros;
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : (words[0]?.slice(0, 2) ?? "PR").toUpperCase();
  const rawCategory = category.trim();
  const label = escapeXml(rawCategory || canonicalCategoryLabel(category, name));
  const safeInitials = escapeXml(initials);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="${palette.bgStart}"/>` +
    `<stop offset="100%" stop-color="${palette.bgEnd}"/>` +
    `</linearGradient></defs>` +
    `<rect width="320" height="220" fill="url(#g)"/>` +
    `<circle cx="272" cy="40" r="52" fill="${palette.accent}" fill-opacity="0.09"/>` +
    `<circle cx="48" cy="186" r="64" fill="${palette.accent}" fill-opacity="0.08"/>` +
    `<rect x="116" y="42" width="88" height="88" rx="22" fill="#FFFFFF" fill-opacity="0.92"/>` +
    `<g transform="translate(136 62)">` +
    `<path d="${palette.glyph}" fill="${palette.accent}"/>` +
    `</g>` +
    `<text x="160" y="160" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="${palette.accent}">${label}</text>` +
    `<text x="160" y="182" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#475569" opacity="0.85">${safeInitials}</text>` +
    `</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Generates a UTF-8 BOM CSV template ready for Excel / Google Sheets import.
 */
export function generateCatalogCsvTemplate(): string {
  const rows = [
    ["Nombre", "Precio", "Categoria", "Descripcion", "Disponible"],
    [
      "Audífonos Inalámbricos ANC Pro",
      "185000",
      "Tecnología y electrodomésticos",
      "Cancelación activa de ruido, Bluetooth 5.3 y batería de 36 horas",
      "Si",
    ],
    [
      "Sérum Facial Vitamina C 30ml",
      "68000",
      "Salud, belleza y cuidado personal",
      "Fórmula antioxidante con ácido hialurónico para todo tipo de piel",
      "Si",
    ],
    [
      "Cafetera Prensa Francesa 1L",
      "92000",
      "Hogar, Muebles, Cocina",
      "Vidrio borosilicato resistente al calor con filtro en acero inoxidable",
      "Si",
    ],
  ];

  const escapeCsvCell = (cell: string) =>
    /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;

  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}`;
}

function parseCopPrice(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return 0;

  // Handle Colombian thousand separators like "24.000" or "24,000"
  if (/^\d{1,3}([.,]\d{3})+$/.test(cleaned)) {
    return parseInt(cleaned.replace(/[.,]/g, ""), 10) || 0;
  }

  // Handle decimal cents like "24000.00" or "24000,50"
  const normalized = cleaned.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

function parseAvailability(raw: string | undefined): boolean {
  if (!raw) return true;
  const normalized = normalizeText(raw);
  if (["no", "false", "0", "agotado", "inactivo", "pausado"].includes(normalized)) {
    return false;
  }
  return true;
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(lines: string[]): string | null {
  const sample = lines.slice(0, 5);
  for (const delimiter of ["\t", ";", ","]) {
    if (sample.some((line) => splitDelimitedLine(line, delimiter).length >= 2)) {
      // Avoid misclassifying free-text lines with " - " and a comma inside description
      const looksFreeText = sample.every(
        (line) => line.includes(" - ") || line.includes(" | "),
      );
      if (delimiter === "," && looksFreeText) continue;
      return delimiter;
    }
  }
  return null;
}

function isHeaderRow(cells: string[]): boolean {
  const first = normalizeText(cells[0] ?? "");
  const second = normalizeText(cells[1] ?? "");
  return (
    ["nombre", "producto", "name", "item", "titulo"].includes(first) &&
    ["precio", "valor", "price", "costo", "categoria"].includes(second)
  );
}

/**
 * Parses CSV (comma, semicolon, or tab delimited, with or without headers)
 * OR free-text lines like:
 *   "Audífonos Inalámbricos - $185.000 - Tecnología y electrodomésticos - Bluetooth 5.3"
 */
export function parseCatalogBulkText(
  rawText: string,
): Array<Omit<CatalogProduct, "id" | "createdAt">> {
  const cleanedText = rawText.replace(/^\uFEFF/, "");
  const lines = cleanedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines);
  const results: Array<Omit<CatalogProduct, "id" | "createdAt">> = [];

  if (delimiter) {
    const rows = lines.map((line) => splitDelimitedLine(line, delimiter));
    const startIndex = rows.length > 0 && isHeaderRow(rows[0]) ? 1 : 0;

    for (let i = startIndex; i < rows.length; i += 1) {
      const cells = rows[i];
      const name = (cells[0] ?? "").trim();
      if (!name) continue;

      const price = parseCopPrice(cells[1]);
      const category = canonicalCategoryLabel(cells[2] ?? "", name);
      const description = (cells[3] ?? "").trim();
      const available = parseAvailability(cells[4]);

      results.push({
        name,
        price,
        category,
        description,
        available,
        image: assignSmartPhoto(name, category),
      });
    }
    return results;
  }

  for (const line of lines) {
    // Try structured free-text separators (" - " or " | ")
    const parts = line
      .split(/\s+(?:-|\||–|—)\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      const name = parts[0];
      const priceIndex = parts.findIndex((part, idx) => idx > 0 && /\d/.test(part));
      const price = priceIndex !== -1 ? parseCopPrice(parts[priceIndex]) : 0;
      const remaining = parts.filter((_, idx) => idx !== 0 && idx !== priceIndex);
      const rawCategory = remaining[0] ?? "";
      const category = canonicalCategoryLabel(rawCategory, name);
      const matchedExplicitCategory = CATALOG_CATEGORIES.some(
        (cat) => normalizeText(cat) === normalizeText(rawCategory),
      );
      const description = matchedExplicitCategory
        ? remaining.slice(1).join(" - ")
        : remaining.join(" - ");

      results.push({
        name,
        price,
        category,
        description,
        available: true,
        image: assignSmartPhoto(name, category),
      });
      continue;
    }

    // Fallback: "Producto $24.000"
    const match = /^(.*?)\s+\$?\s*([\d.,]+)\s*$/.exec(line);
    const name = (match ? match[1] : line).trim();
    if (!name) continue;
    const price = match ? parseCopPrice(match[2]) : 0;
    const category = canonicalCategoryLabel("", name);

    results.push({
      name,
      price,
      category,
      description: "",
      available: true,
      image: assignSmartPhoto(name, category),
    });
  }

  return results;
}

export function createDemoCatalogProducts(
  now: Date = new Date(),
): CatalogProduct[] {
  const createdAt = now.toISOString();
  const base: Array<Omit<CatalogProduct, "image" | "createdAt">> = [
    {
      id: "prod-demo-1",
      name: "Kit Cuidado Facial Vitamina C",
      description: "Sérum iluminador 30ml + protector solar mineral SPF 50 de rápida absorción.",
      price: 118000,
      category: "Salud, belleza y cuidado personal",
      available: true,
    },
    {
      id: "prod-demo-2",
      name: "Cafetera Prensa Francesa 1L",
      description: "Vidrio borosilicato resistente al calor con filtro doble en acero inoxidable.",
      price: 92000,
      category: "Hogar, Muebles, Cocina",
      available: true,
    },
    {
      id: "prod-demo-3",
      name: "Audífonos Inalámbricos ANC Pro",
      description: "Cancelación activa de ruido, carga rápida USB-C y hasta 36 horas de autonomía.",
      price: 185000,
      category: "Tecnología y electrodomésticos",
      available: true,
    },
    {
      id: "prod-demo-4",
      name: "Chaqueta Impermeable Urbana",
      description: "Tela antifluido liviana con capota ajustable y bolsillos sellados para lluvia.",
      price: 145000,
      category: "Moda, Ropa y Accesorios",
      available: true,
    },
    {
      id: "prod-demo-5",
      name: "Set Mancuernas Ajustables 15kg",
      description: "Discos recubiertos en neopreno antideslizante con barra conectora para entrenamiento en casa.",
      price: 164000,
      category: "Deportes y Fitness",
      available: true,
    },
    {
      id: "prod-demo-6",
      name: "Cama Ortopédica Lavable Mascotas",
      description: "Espuma viscoelástica con funda impermeable removible para perros medianos y grandes.",
      price: 129000,
      category: "Animales y Mascotas",
      available: false,
    },
  ];

  return base.map((item) => ({
    ...item,
    image: assignSmartPhoto(item.name, item.category),
    createdAt,
  }));
}
