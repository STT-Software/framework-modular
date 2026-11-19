export const SUPPORT_CATEGORIES = ["Negocios", "Accesos OTP", "Módulos"] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export interface SupportFaqItem {
  id: string;
  category: SupportCategory;
  question: string;
  answer: string;
  keywords: readonly string[];
}

export interface SupportQuickTopic {
  id: string;
  label: string;
  question: string;
}

export const SUPPORT_FALLBACK_REPLY =
  "No encontré una respuesta exacta en nuestra guía rápida para esa consulta. Puedes escribirnos directamente por WhatsApp o enviar un correo a soporte@necto.co y el equipo de soporte de Necto te ayudará enseguida.";

export const SUPPORT_FAQS: readonly SupportFaqItem[] = [
  {
    id: "create-business",
    category: "Negocios",
    question: "¿Cómo creo y configuro un nuevo negocio?",
    answer:
      "Haz clic en Crear negocio desde el directorio, la barra lateral o el selector superior para abrir el asistente de 3 pasos: Identidad (datos fiscales, contacto, categoría, moneda y zona horaria), Módulos y Jefe de negocio. Al guardar, el negocio queda activo de inmediato en tu workspace.",
    keywords: [
      "crear",
      "creo",
      "nuevo",
      "negocio",
      "configurar",
      "configuro",
      "asistente",
      "pasos",
      "identidad",
      "registrar",
      "alta",
    ],
  },
  {
    id: "otp-admin-access",
    category: "Accesos OTP",
    question: "¿Cómo funciona el acceso OTP y la asignación del administrador?",
    answer:
      "Al asignar un administrador con su nombre y correo electrónico, Necto envía una invitación con un código OTP de un solo uso para ingresar sin contraseña. Si editas el negocio y cambias el correo del administrador, la persona anterior pierde el acceso y la nueva recibe su invitación; si solo cambias el nombre, no se envía una nueva invitación. Desde la pestaña Equipo de la ficha puedes consultar el estado del envío o reenviar la invitación respetando la espera de 60 segundos.",
    keywords: [
      "otp",
      "acceso",
      "administrador",
      "administradores",
      "jefe",
      "invitacion",
      "correo",
      "email",
      "contrasena",
      "reemplazar",
      "asignar",
      "reenviar",
      "login",
      "ingresar",
    ],
  },
  {
    id: "temporary-access-code",
    category: "Accesos OTP",
    question: "¿Cómo genero un código temporal manual de 10 minutos?",
    answer:
      "Abre la ficha completa del negocio, entra a la pestaña Equipo y selecciona Generar código temporal. El código tiene una vigencia de 10 minutos, se muestra una sola vez con la opción Copiar código y reemplaza cualquier código temporal anterior. Si cierras la ficha o cambias de pestaña antes de copiarlo, puedes generar uno nuevo. Si necesitas bloquear temporalmente el acceso del administrador, desde la misma ficha puedes pausar o reanudar el negocio.",
    keywords: [
      "codigo",
      "temporal",
      "manual",
      "10",
      "minutos",
      "generar",
      "genero",
      "provisional",
      "copiar",
      "vence",
      "expira",
      "equipo",
    ],
  },
  {
    id: "pause-resume-business",
    category: "Negocios",
    question: "¿Qué sucede al pausar o reanudar un negocio?",
    answer:
      "Desde la ficha completa del negocio puedes pausarlo en cualquier momento. Mientras un negocio permanece pausado, la sesión de su administrador queda bloqueada temporalmente sin perder su configuración ni sus módulos. Cuando lo reanudas, el acceso se restablece de inmediato y el estado se actualiza tanto en el directorio como en el selector superior.",
    keywords: [
      "pausar",
      "pauso",
      "pausa",
      "pausado",
      "reanudar",
      "reanudo",
      "reactivar",
      "suspender",
      "bloquear",
      "estado",
      "activo",
    ],
  },
  {
    id: "available-modules",
    category: "Módulos",
    question: "¿Qué módulos ofrece Necto para cada negocio?",
    answer:
      "Necto ofrece seis módulos configurables para cada negocio: Reservas (mesas, espacios o servicios), Turnos (filas y llamados en tiempo real), Agendamiento (citas por profesional y horario), Referidos (invitaciones y seguimiento), Inventario (productos, existencias y movimientos) y Pedidos (seguimiento desde la solicitud hasta la entrega).",
    keywords: [
      "modulo",
      "modulos",
      "reservas",
      "turnos",
      "agendamiento",
      "referidos",
      "inventario",
      "pedidos",
      "catalogo",
      "ofrece",
      "disponibles",
    ],
  },
  {
    id: "manage-modules",
    category: "Módulos",
    question: "¿Cómo activo o cambio los módulos de un negocio?",
    answer:
      "Cada negocio puede operar con entre 0 y 6 módulos activos. Puedes seleccionarlos en el paso Módulos al crear el negocio o ajustarlos después desde Editar configuración. En la pestaña Módulos de la ficha completa puedes revisar en cualquier momento cuáles están habilitados.",
    keywords: [
      "modulo",
      "modulos",
      "activar",
      "activo",
      "desactivar",
      "cambiar",
      "cambio",
      "habilitar",
      "quitar",
      "seleccionar",
    ],
  },
  {
    id: "export-csv",
    category: "Negocios",
    question: "¿Cómo exporto mis negocios a un archivo CSV?",
    answer:
      "En el encabezado del directorio haz clic en Exportar CSV. El archivo se genera directamente desde el servidor respetando el texto buscado y los filtros de industria o estado que tengas activos en ese momento. El botón se habilita en cuanto tienes al menos un negocio registrado.",
    keywords: [
      "exportar",
      "exporto",
      "csv",
      "descargar",
      "archivo",
      "excel",
      "reporte",
      "filtros",
      "lista",
    ],
  },
  {
    id: "edit-business-settings",
    category: "Negocios",
    question: "¿Cómo edito la configuración de un negocio existente?",
    answer:
      "Puedes editar un negocio desde el botón Editar configuración en su ficha completa o directamente desde el selector superior de negocios. El asistente conserva el identificador del negocio y te permite actualizar datos de identidad, NIT, moneda, zona horaria, módulos activos y administrador.",
    keywords: [
      "editar",
      "edito",
      "configuracion",
      "actualizar",
      "modificar",
      "moneda",
      "zona",
      "horaria",
      "nit",
      "datos",
      "selector",
    ],
  },
];

export const SUPPORT_QUICK_TOPICS: readonly SupportQuickTopic[] = [
  {
    id: "create-business",
    label: "Crear y configurar un negocio",
    question: "¿Cómo creo y configuro un nuevo negocio?",
  },
  {
    id: "otp-access",
    label: "Cómo funciona el acceso OTP de administradores",
    question: "¿Cómo funciona el acceso OTP y la asignación del administrador?",
  },
  {
    id: "modules",
    label: "Activar o cambiar módulos en un negocio",
    question: "¿Cómo activo o cambio los módulos de un negocio?",
  },
  {
    id: "pause-or-temp-code",
    label: "Pausar un negocio o generar código temporal",
    question: "¿Cómo pauso un negocio o genero un código temporal?",
  },
];

const SPANISH_STOP_WORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "en",
  "por",
  "para",
  "con",
  "sin",
  "sobre",
  "que",
  "como",
  "cual",
  "cuales",
  "donde",
  "cuando",
  "quien",
  "mi",
  "mis",
  "tu",
  "tus",
  "su",
  "sus",
  "se",
  "es",
  "son",
  "esta",
  "estan",
  "este",
  "esto",
  "esa",
  "ese",
  "hay",
  "puedo",
  "puede",
  "pueden",
  "hacer",
  "hago",
  "hola",
  "ayuda",
  "necesito",
  "quiero",
  "saber",
  "favor",
  "gracias",
  "necto",
  "al",
  "lo",
  "le",
  "les",
  "me",
  "te",
  "nos",
  "mas",
  "muy",
  "ya",
  "si",
  "no",
]);

const MIN_MATCH_SCORE = 3;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tokenize(value: string): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  return normalized
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !SPANISH_STOP_WORDS.has(token));
}

function hasPrefixMatch(token: string, candidates: readonly string[]): boolean {
  if (token.length < 4) return false;
  return candidates.some(
    (candidate) =>
      candidate.length >= 4 && (candidate.startsWith(token) || token.startsWith(candidate)),
  );
}

interface IndexedFaq {
  item: SupportFaqItem;
  normalizedQuestion: string;
  searchableText: string;
  keywordTokens: readonly string[];
  questionTokens: readonly string[];
  categoryTokens: readonly string[];
  answerTokens: readonly string[];
}

const INDEXED_FAQS: readonly IndexedFaq[] = SUPPORT_FAQS.map((item) => {
  const normalizedQuestion = normalizeText(item.question);
  const keywordTokens = Array.from(new Set(item.keywords.map(normalizeText).filter(Boolean)));
  const questionTokens = Array.from(new Set(tokenize(item.question)));
  const categoryTokens = Array.from(new Set(tokenize(item.category)));
  const answerTokens = Array.from(new Set(tokenize(item.answer)));
  const searchableText = normalizeText(
    `${item.question} ${item.answer} ${item.category} ${item.keywords.join(" ")}`,
  );

  return {
    item,
    normalizedQuestion,
    searchableText,
    keywordTokens,
    questionTokens,
    categoryTokens,
    answerTokens,
  };
});

/**
 * Filters support FAQ items by optional category pill and accent-insensitive search query.
 */
export function filterSupportFaqs(
  query: string,
  category: SupportCategory | null,
): SupportFaqItem[] {
  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenize(query);

  return INDEXED_FAQS.filter((entry) => {
    if (category && entry.item.category !== category) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    if (entry.searchableText.includes(normalizedQuery)) {
      return true;
    }

    if (queryTokens.length > 0) {
      return queryTokens.every((token) => entry.searchableText.includes(token));
    }

    return false;
  }).map((entry) => entry.item);
}

/**
 * Produces a deterministic Spanish support answer by scoring tokens against the local FAQ knowledge base.
 * Falls back to WhatsApp and email contact guidance when no FAQ reaches the relevance threshold.
 */
export function replyToSupportQuestion(question: string): string {
  const normalizedQuestion = normalizeText(question);
  if (!normalizedQuestion) {
    return SUPPORT_FALLBACK_REPLY;
  }

  const exactMatch = INDEXED_FAQS.find((entry) => entry.normalizedQuestion === normalizedQuestion);
  if (exactMatch) {
    return exactMatch.item.answer;
  }

  const queryTokens = Array.from(new Set(tokenize(question)));
  if (queryTokens.length === 0) {
    return SUPPORT_FALLBACK_REPLY;
  }

  let bestEntry: IndexedFaq | null = null;
  let bestScore = 0;

  for (const entry of INDEXED_FAQS) {
    let score = 0;

    for (const token of queryTokens) {
      if (entry.keywordTokens.includes(token)) {
        score += 4;
      } else if (entry.questionTokens.includes(token)) {
        score += 3;
      } else if (entry.categoryTokens.includes(token)) {
        score += 2;
      } else if (entry.answerTokens.includes(token)) {
        score += 1;
      } else if (hasPrefixMatch(token, entry.keywordTokens)) {
        score += 2;
      } else if (hasPrefixMatch(token, entry.questionTokens)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (!bestEntry || bestScore < MIN_MATCH_SCORE) {
    return SUPPORT_FALLBACK_REPLY;
  }

  return bestEntry.item.answer;
}
