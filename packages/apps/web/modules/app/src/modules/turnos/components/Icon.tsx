/** Un icono de 24x24 con los trazos de la referencia (ver `icons.ts`: salen del propio código, no de datos de la persona). */
export function Icon({ paths, className }: { paths: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: paths }} />;
}
