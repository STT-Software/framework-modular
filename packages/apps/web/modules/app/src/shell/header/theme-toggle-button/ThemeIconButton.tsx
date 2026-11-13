import { observer } from "mobx-react-lite";
import { uiStore } from "@/stores";

/**
 * Botón redondo para cambiar entre tema claro y oscuro. Usa el mismo `uiStore` que el resto de la app y deja
 * el acabado (tamaño, borde, colores) a quien lo usa mediante `className`.
 */
export const ThemeIconButton = observer(({ className }: { className: string }) => {
  const dark = uiStore.isDarkMode;
  return (
    <button
      type="button"
      className={className}
      onClick={() => uiStore.toggleTheme()}
      aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
      aria-pressed={dark}
    >
      {dark ? (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19m0-14-1.4 1.4M6.4 17.6 5 19"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20.6 14A8.7 8.7 0 0 1 10 3.4 8.7 8.7 0 1 0 20.6 14Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
});
