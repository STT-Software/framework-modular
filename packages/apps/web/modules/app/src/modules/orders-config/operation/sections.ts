export const salesSections = [
  { id: "orders", name: "Gestión de pedidos", icon: "tickets" },
  { id: "incidents", name: "Gestión de novedades", icon: "bell" },
  { id: "carriers", name: "Transportadoras", icon: "queue" },
  { id: "catalog", name: "Catálogo", icon: "grid" },
  { id: "conversations", name: "Conversaciones", icon: "message" },
  { id: "analytics", name: "Analítica", icon: "activity" },
  { id: "operators", name: "Operadores", icon: "users" },
] as const;

export type SalesSection = (typeof salesSections)[number]["id"];
