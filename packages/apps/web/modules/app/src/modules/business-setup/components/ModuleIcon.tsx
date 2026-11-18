import { moduleInfo } from "@/modules/businesses";

/** El icono de un módulo, con su color. Los trazos salen del catálogo del propio código (no de datos del usuario). */
export function ModuleIcon({ id, color, icon }: { id?: string; color?: string; icon?: string }) {
  const info = id ? moduleInfo(id) : undefined;
  const paint = color ?? info?.color;
  const paths = icon ?? info?.icon;
  if (!paths) return null;
  return (
    <span className="no-module-icon" data-color={paint} aria-hidden="true">
      <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: paths }} />
    </span>
  );
}
