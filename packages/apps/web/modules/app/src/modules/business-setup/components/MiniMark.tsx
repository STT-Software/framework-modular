import { NectoLogo } from "@/brand/NectoLogo";

/** La marca de Necto en pequeño, como adorno del panel lateral y del tipo de negocio. */
export const MiniMark = () => (
  <span className="no-mini-mark" aria-hidden="true">
    <NectoLogo variant="mark" width={64} height={64} />
  </span>
);
