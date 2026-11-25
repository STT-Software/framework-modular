export interface Carrier {
  id: string;
  name: string;
  logo?: string;

  logoBackground?: "dark";
}

export const CARRIERS: Carrier[] = [
  { id: "propio", name: "Envío propio" },
  {
    id: "envia",
    name: "Envía",
    logo: "/images/order-carriers/envia-mensajeria-seeklogo.png",
  },
  {
    id: "coordinadora",
    name: "Coordinadora",
    logo: "/images/order-carriers/coordinadora-seeklogo.png",
  },
  {
    id: "servientrega",
    name: "Servientrega",
    logo: "/images/order-carriers/servientrega-seeklogo.png",
  },
  {
    id: "tcc",
    name: "TCC",
    logo: "/images/order-carriers/tcc-seeklogo.png",
  },
  {
    id: "interrapidisimo",
    name: "InterRapidísimo",
    logo: "/images/order-carriers/interrapidisimo-logo.webp",
    logoBackground: "dark",
  },
];

const normalizeName = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export function carrierByName(name: string): Carrier | undefined {
  const needle = normalizeName(name ?? "");
  if (!needle) return undefined;
  return CARRIERS.find((t) => normalizeName(t.name) === needle);
}
