import type { OrdersProfileId } from "../../types";
import { assignSmartPhoto, type CatalogProduct } from "./catalogDomain";

export interface ProfileStorefrontCopy {
  tagline: string;
  searchPlaceholder: string;
  emptyCartCopy: string;
  ctaLabel: string;
  deliveryLabel: string;
  pickupLabel: string;
  itemSingular: string;
  itemPlural: string;
  supportsVariants: boolean;
}

export interface ProfilePreset {
  id: OrdersProfileId;
  name: string;
  storefront: ProfileStorefrontCopy;
  stageLabels: Partial<Record<"preparing" | "ready" | "in_transit", string>>;
  sampleCatalog: Array<Omit<CatalogProduct, "createdAt">>;
}

const VALID_PROFILES: ReadonlySet<OrdersProfileId> = new Set<OrdersProfileId>([
  "food",
  "fashion",
  "general",
  "services",
]);

export function isValidOrdersProfileId(value: unknown): value is OrdersProfileId {
  return typeof value === "string" && VALID_PROFILES.has(value as OrdersProfileId);
}

function buildPresetItem(
  item: Omit<CatalogProduct, "image" | "createdAt">,
): Omit<CatalogProduct, "createdAt"> {
  return {
    ...item,
    image: assignSmartPhoto(item.name, item.category),
  };
}

export const BUSINESS_PROFILE_PRESETS: Record<OrdersProfileId, ProfilePreset> = {
  food: {
    id: "food",
    name: "Alimentos y Bebidas",
    storefront: {
      tagline: "Pide tus platos favoritos recién preparados, a domicilio o para recoger.",
      searchPlaceholder: "Buscar platos, bebidas, postres...",
      emptyCartCopy: "Tu pedido está vacío. Agrega tus platos favoritos del menú.",
      ctaLabel: "Confirmar pedido",
      deliveryLabel: "Entrega a Domicilio",
      pickupLabel: "Recoger en Restaurante",
      itemSingular: "plato",
      itemPlural: "platos",
      supportsVariants: false,
    },
    stageLabels: {
      preparing: "En cocina",
      ready: "Listo para servir",
      in_transit: "En domicilio",
    },
    sampleCatalog: [
      buildPresetItem({
        id: "prod-food-1",
        name: "Pizza BBQ Artesanal",
        description: "Masa de fermentación lenta con salsa BBQ ahumada, queso mozzarella y pollo desmechado.",
        price: 32000,
        category: "Pizzas",
        available: true,
      }),
      buildPresetItem({
        id: "prod-food-2",
        name: "Hamburguesa Doble Angus Brioche",
        description: "Doble carne Angus 150g, queso cheddar fundido, tocineta crocante y vegetales frescos.",
        price: 29000,
        category: "Hamburguesas",
        available: true,
      }),
      buildPresetItem({
        id: "prod-food-3",
        name: "Pasta Penne al Pesto Genovés",
        description: "Pasta al dente en crema de albahaca fresca, piñones tostados y queso parmesano madurado.",
        price: 26000,
        category: "Pastas",
        available: true,
      }),
      buildPresetItem({
        id: "prod-food-4",
        name: "Arroz Salteado Especial de la Casa",
        description: "Arroz al wok con pollo tierno, vegetales crocantes, raíces chinas y salsa teriyaki.",
        price: 27000,
        category: "Arroces",
        available: true,
      }),
      buildPresetItem({
        id: "prod-food-5",
        name: "Limonada de Coco Natural",
        description: "Bebida refrescante preparada al instante con leche de coco y limón recién exprimido.",
        price: 11000,
        category: "Bebidas",
        available: true,
      }),
      buildPresetItem({
        id: "prod-food-6",
        name: "Cheesecake de Frutos Rojos",
        description: "Base crujiente de galleta con queso crema suave y reducción artesanal de mora y fresa.",
        price: 14500,
        category: "Postres",
        available: true,
      }),
    ],
  },
  fashion: {
    id: "fashion",
    name: "Ropa, Calzado y Accesorios",
    storefront: {
      tagline: "Explora nuestra colección, elige tu talla y recibe en la puerta de tu casa.",
      searchPlaceholder: "Buscar prendas, calzado, tallas...",
      emptyCartCopy: "Tu bolsa está vacía. Selecciona tus prendas y tallas favoritas.",
      ctaLabel: "Finalizar compra",
      deliveryLabel: "Envío a Domicilio",
      pickupLabel: "Recoger en Tienda",
      itemSingular: "prenda",
      itemPlural: "prendas",
      supportsVariants: true,
    },
    stageLabels: {
      preparing: "Empacando pedido",
      ready: "Listo para despacho",
      in_transit: "Despachado",
    },
    sampleCatalog: [
      buildPresetItem({
        id: "prod-fashion-1",
        name: "Camiseta Oversize Algodón Pima",
        description: "Tejido 100% algodón peruano de 240g con caída estructurada y cuello acanalado.",
        price: 78000,
        category: "Camisetas",
        variants: ["S", "M", "L", "XL"],
        available: true,
      }),
      buildPresetItem({
        id: "prod-fashion-2",
        name: "Jean Recto Tiro Alto Índigo",
        description: "Denim rígido lavado medio con costuras reforzadas y silueta clásica atemporal.",
        price: 159000,
        category: "Jeans",
        variants: ["28", "30", "32", "34"],
        available: true,
      }),
      buildPresetItem({
        id: "prod-fashion-3",
        name: "Vestido Midi Lino Natural",
        description: "Corte fluido en mezcla de lino fresco con escote cuadrado y bolsillos laterales.",
        price: 184000,
        category: "Vestidos",
        variants: ["XS", "S", "M", "L"],
        available: true,
      }),
      buildPresetItem({
        id: "prod-fashion-4",
        name: "Chaqueta Impermeable Urbana",
        description: "Tela antifluido liviana con capota ajustable y bolsillos sellados para lluvia.",
        price: 145000,
        category: "Chaquetas",
        variants: ["S", "M", "L", "XL"],
        available: true,
      }),
      buildPresetItem({
        id: "prod-fashion-5",
        name: "Tenis Running Ultralight",
        description: "Suela amortiguada de alta respuesta con malla respirable para uso diario o trote.",
        price: 229000,
        category: "Calzado",
        variants: ["37", "38", "39", "40", "41"],
        available: true,
      }),
      buildPresetItem({
        id: "prod-fashion-6",
        name: "Bolso Bandolera Cuero Vegano",
        description: "Diseño compacto con correa graduable, cierre metálico y compartimento interno.",
        price: 112000,
        category: "Accesorios",
        variants: ["Negro", "Camel", "Oliva"],
        available: true,
      }),
    ],
  },
  general: {
    id: "general",
    name: "Comercio General / Retail",
    storefront: {
      tagline: "Selecciona tus productos preferidos y arma tu pedido en segundos.",
      searchPlaceholder: "Buscar en el catálogo...",
      emptyCartCopy: "Tu carrito está vacío. Agrega tus productos favoritos.",
      ctaLabel: "Proceder al Pago",
      deliveryLabel: "Entrega a Domicilio",
      pickupLabel: "Retiro en Local",
      itemSingular: "producto",
      itemPlural: "productos",
      supportsVariants: false,
    },
    stageLabels: {
      preparing: "En preparación",
      ready: "Listo",
      in_transit: "En camino",
    },
    sampleCatalog: [
      buildPresetItem({
        id: "prod-demo-1",
        name: "Kit Cuidado Facial Vitamina C",
        description: "Sérum iluminador 30ml + protector solar mineral SPF 50 de rápida absorción.",
        price: 118000,
        category: "Salud, belleza y cuidado personal",
        available: true,
      }),
      buildPresetItem({
        id: "prod-demo-2",
        name: "Cafetera Prensa Francesa 1L",
        description: "Vidrio borosilicato resistente al calor con filtro doble en acero inoxidable.",
        price: 92000,
        category: "Hogar, Muebles, Cocina",
        available: true,
      }),
      buildPresetItem({
        id: "prod-demo-3",
        name: "Audífonos Inalámbricos ANC Pro",
        description: "Cancelación activa de ruido, carga rápida USB-C y hasta 36 horas de autonomía.",
        price: 185000,
        category: "Tecnología y electrodomésticos",
        available: true,
      }),
      buildPresetItem({
        id: "prod-demo-4",
        name: "Chaqueta Impermeable Urbana",
        description: "Tela antifluido liviana con capota ajustable y bolsillos sellados para lluvia.",
        price: 145000,
        category: "Moda, Ropa y Accesorios",
        available: true,
      }),
      buildPresetItem({
        id: "prod-demo-5",
        name: "Set Mancuernas Ajustables 15kg",
        description: "Discos recubiertos en neopreno antideslizante con barra conectora para entrenamiento en casa.",
        price: 164000,
        category: "Deportes y Fitness",
        available: true,
      }),
      buildPresetItem({
        id: "prod-demo-6",
        name: "Cama Ortopédica Lavable Mascotas",
        description: "Espuma viscoelástica con funda impermeable removible para perros medianos y grandes.",
        price: 129000,
        category: "Animales y Mascotas",
        available: false,
      }),
    ],
  },
  services: {
    id: "services",
    name: "Encargos y Servicios a Pedido",
    storefront: {
      tagline: "Solicita servicios o encargos a medida y coordina la atención sin filas.",
      searchPlaceholder: "Buscar servicios, sesiones o encargos...",
      emptyCartCopy: "Aún no has seleccionado servicios. Agrega el que necesites para comenzar.",
      ctaLabel: "Solicitar servicio",
      deliveryLabel: "Servicio a Domicilio",
      pickupLabel: "Atención en Sede",
      itemSingular: "servicio",
      itemPlural: "servicios",
      supportsVariants: false,
    },
    stageLabels: {
      preparing: "En atención",
      ready: "Por finalizar",
      in_transit: "En curso",
    },
    sampleCatalog: [
      buildPresetItem({
        id: "prod-srv-1",
        name: "Corte y Estilismo Personalizado",
        description: "Diagnóstico capilar, lavado revitalizante, corte a medida y peinado profesional.",
        price: 65000,
        category: "Estilismo",
        available: true,
      }),
      buildPresetItem({
        id: "prod-srv-2",
        name: "Masaje Relajante Descontracturante",
        description: "Sesión de 60 minutos con aromaterapia y aceites esenciales para liberar tensión muscular.",
        price: 110000,
        category: "Spa y Bienestar",
        available: true,
      }),
      buildPresetItem({
        id: "prod-srv-3",
        name: "Limpieza Facial Profunda Hidratante",
        description: "Exfoliación suave, extracción, mascarilla calmante y protección solar dermatológica.",
        price: 125000,
        category: "Spa y Bienestar",
        available: true,
      }),
      buildPresetItem({
        id: "prod-srv-4",
        name: "Asesoría de Imagen y Colorimetría",
        description: "Sesión personalizada de 90 minutos con paleta cromática y guía práctica de estilo.",
        price: 190000,
        category: "Asesoría",
        available: true,
      }),
      buildPresetItem({
        id: "prod-srv-5",
        name: "Mantenimiento Preventivo de Equipo",
        description: "Limpieza interna, cambio de pasta térmica, diagnóstico de rendimiento y optimización.",
        price: 95000,
        category: "Mantenimiento",
        available: true,
      }),
      buildPresetItem({
        id: "prod-srv-6",
        name: "Ajuste y Confección de Prenda a Medida",
        description: "Entalle profesional, dobladillo o transformación personalizada con prueba incluida.",
        price: 48000,
        category: "Asesoría",
        available: true,
      }),
    ],
  },
};

export function getProfilePreset(profile?: OrdersProfileId | null): ProfilePreset {
  if (profile && isValidOrdersProfileId(profile)) {
    return BUSINESS_PROFILE_PRESETS[profile];
  }
  return BUSINESS_PROFILE_PRESETS.general;
}

export function createCatalogProductsForProfile(
  profile?: OrdersProfileId | null,
  now: Date = new Date(),
): CatalogProduct[] {
  const preset = getProfilePreset(profile);
  const createdAt = now.toISOString();
  return preset.sampleCatalog.map((item) => ({
    ...item,
    gallery: item.gallery ? [...item.gallery] : undefined,
    variants: item.variants ? [...item.variants] : undefined,
    image: item.image || assignSmartPhoto(item.name, item.category),
    createdAt,
  }));
}

const memoryProfileFallback = new Map<string, OrdersProfileId>();

function profileStorageKey(businessId: string): string {
  return `necto.pedidos.profile.${businessId || "default"}`;
}

export function readActiveBusinessProfile(businessId: string): OrdersProfileId {
  const key = profileStorageKey(businessId);
  if (typeof window === "undefined") {
    return memoryProfileFallback.get(key) ?? "general";
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (isValidOrdersProfileId(raw)) {
      return raw;
    }
    return "general";
  } catch {
    return memoryProfileFallback.get(key) ?? "general";
  }
}

export function writeActiveBusinessProfile(
  businessId: string,
  profile: OrdersProfileId,
): void {
  if (!isValidOrdersProfileId(profile)) return;
  const key = profileStorageKey(businessId);
  if (typeof window === "undefined") {
    memoryProfileFallback.set(key, profile);
    return;
  }
  try {
    window.localStorage.setItem(key, profile);
  } catch {
    memoryProfileFallback.set(key, profile);
  }
}
