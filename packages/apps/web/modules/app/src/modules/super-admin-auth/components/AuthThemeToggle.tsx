import { observer } from "mobx-react-lite";
import { uiStore } from "@/stores";

/** Interruptor claro/oscuro del diseño Necto. Usa el mismo tema que el resto de la app. */
export const AuthThemeToggle = observer(() => {
  const dark = uiStore.isDarkMode;

  return (
    <button
      type="button"
      onClick={() => uiStore.toggleTheme()}
      aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
      aria-pressed={dark}
      className="sa-theme-toggle flex h-11 items-center justify-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      <svg className="dark:hidden" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M20.6 14A8.7 8.7 0 0 1 10 3.4 8.7 8.7 0 1 0 20.6 14Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <svg className="hidden dark:block" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42m0-14.14-1.42 1.42m-11.3 11.3-1.42 1.42"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="sa-theme-label">{dark ? "Oscuro" : "Claro"}</span>
    </button>
  );
});
