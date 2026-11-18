import type { CategoryId } from "@/modules/businesses";

/** Cómo se presenta cada tipo de negocio en el paso 3 (los identificadores son los que acepta el servidor). */
export const CATEGORY_CARDS: ReadonlyArray<{ id: CategoryId; name: string; description: string; color: string; icon: string }> = [
  {
    id: "gastronomy",
    name: "Gastronomía",
    description: "Restaurantes, cafés y experiencias alrededor de la mesa.",
    color: "orange",
    icon: "<path d='M5 3v7m3-7v7M3 7h7M6.5 10v11M17 3v18m0-18c-4 2-4 8 0 9'/>",
  },
  {
    id: "retail",
    name: "Retail y boutique",
    description: "Tiendas, comercios y productos con una identidad propia.",
    color: "purple",
    icon: "<path d='M4 9v12h16V9M3 3h18l1 6a3 3 0 0 1-5 1 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5-1l1-6ZM9 21v-7h6v7'/>",
  },
  {
    id: "professional-services",
    name: "Servicios profesionales",
    description: "Oficinas, asesorías y atención especializada a tus clientes.",
    color: "blue",
    icon: "<rect x='3' y='7' width='18' height='14' rx='3'/><path d='M8 7V3h8v4M3 12c6 3 12 3 18 0m-9-1v5'/>",
  },
  {
    id: "health-wellness",
    name: "Salud y bienestar",
    description: "Clínicas, centros de bienestar, cuidado personal y estética.",
    color: "green",
    icon: "<rect x='3' y='3' width='18' height='18' rx='5'/><path d='M12 7v10m-5-5h10'/>",
  },
  {
    id: "other",
    name: "Otro / Personalizado",
    description: "Tu negocio tiene su propia forma de conectar. Cuéntanos cuál.",
    color: "amber",
    icon: "<path d='M12 3v18M3 12h18'/>",
  },
];
