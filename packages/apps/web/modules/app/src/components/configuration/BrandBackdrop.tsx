import type { ReactNode } from "react";

/**
 * Decoración sutil de geometría de marca de Necto (máximo 3 formas)
 * para el fondo de las tarjetas blancas principales en Setup, Turnos y Pedidos.
 * Inspiradas en la composición de bienvenida /welcome/ready.
 */
export function BrandCardDecor({ className }: { className?: string }) {
  return (
    <div className={`card-brand-decor${className ? ` ${className}` : ""}`} aria-hidden="true">
      <div className="card-brand-shape is-ring tone-indigo" />
      <div className="card-brand-shape is-wave tone-cyan">
        <svg viewBox="0 0 120 30" fill="none">
          <path d="M6 15 C14 3 24 3 32 15 S50 27 58 15 S76 3 84 15 S102 27 114 15" />
        </svg>
      </div>
      <div className="card-brand-shape is-arc tone-orange" />
    </div>
  );
}

/**
 * Componente retrocompatible para llamadas existentes a BrandBackdrop.
 * No renderiza elementos fijos en el viewport para no interferir con el fondo global.
 */
export function BrandBackdrop() {
  return null;
}
