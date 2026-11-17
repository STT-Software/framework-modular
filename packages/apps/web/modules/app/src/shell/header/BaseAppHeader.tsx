import { ReactNode } from "react";
import { observer } from 'mobx-react-lite';
import { uiStore } from "@/stores";

interface BaseAppHeaderProps {
  leftContent?: ReactNode;
  mobileLogo?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Floating rounded navbar matching StockFlow's BaseAppHeader design.
 */
export const BaseAppHeader: React.FC<BaseAppHeaderProps> = observer(({
  leftContent,
  mobileLogo,
  children,
  className = "",
}) => {
  return (
    <header
      className={`relative z-30 flex w-full rounded-2xl border border-gray-200/80 bg-white dark:border-white/10 dark:bg-gray-900 shadow-theme-xs ${className}`.trim()}
    >
      <div className="flex flex-col items-center justify-between grow xl:flex-row xl:px-5">
        {/* Top row */}
        <div className="flex items-center justify-between w-full min-h-[62px] md:min-h-[68px] gap-2 px-3 py-2.5 sm:gap-4 xl:justify-normal xl:px-0 xl:py-3">
          {leftContent}

          {/* Mobile logo - center */}
          {mobileLogo && (
            <div className="xl:hidden">
              {mobileLogo}
            </div>
          )}

          {/* Mobile menu toggle - 3 dots */}
          <button
            type="button"
            onClick={() => uiStore.toggleHeaderMenu()}
            className="flex items-center justify-center w-10 h-10 text-gray-600 rounded-xl transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06] xl:hidden"
            aria-label="Abrir menú de cabecera"
            aria-expanded={uiStore.headerMenuOpen}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5.99902 10.4951C6.82745 10.4951 7.49902 11.1667 7.49902 11.9951V12.0051C7.49902 12.8335 6.82745 13.5051 5.99902 13.5051C5.1706 13.5051 4.49902 12.8335 4.49902 12.0051V11.9951C4.49902 11.1667 5.1706 10.4951 5.99902 10.4951ZM17.999 10.4951C18.8275 10.4951 19.499 11.1667 19.499 11.9951V12.0051C19.499 12.8335 18.8275 13.5051 17.999 13.5051C17.1706 13.5051 16.499 12.8335 16.499 12.0051V11.9951C16.499 11.1667 17.1706 10.4951 17.999 10.4951ZM13.499 11.9951C13.499 11.1667 12.8275 10.4951 11.999 10.4951C11.1706 10.4951 10.499 11.1667 10.499 11.9951V12.0051C10.499 12.8335 11.1706 13.5051 11.999 13.5051C12.8275 13.5051 13.499 12.8335 13.499 12.0051V11.9951Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        {/* Actions row - hidden on mobile until menu opened */}
        <div
          className={`${
            uiStore.headerMenuOpen
              ? "flex border-t border-gray-200/70 dark:border-white/5"
              : "hidden"
          } items-center justify-end w-full gap-3 px-4 py-3 xl:flex xl:border-t-0 xl:px-0 xl:py-0`}
        >
          {children}
        </div>
      </div>
    </header>
  );
});

export default BaseAppHeader;
