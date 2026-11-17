import { ReactNode } from "react";
import { observer } from 'mobx-react-lite';
import { uiStore } from "@/stores";
import { Backdrop } from "@/shell/sidebar/Backdrop";

interface BaseAppShellProps {
  sidebar: ReactNode;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  noCard?: boolean;
  pantallaFija?: boolean;
  className?: string;
}

/**
 * Floating layout shell matching StockFlow's BaseAppShell architecture:
 * floating card/rail sidebar + floating header + floating .necto-panel content frame.
 */
export const BaseAppShell: React.FC<BaseAppShellProps> = observer(({
  sidebar,
  header,
  footer,
  children,
  noCard = false,
  pantallaFija = false,
  className = "",
}) => {
  return (
    <div className={`necto-lienzo ${pantallaFija ? "h-screen overflow-hidden" : "min-h-screen"} xl:flex ${className}`.trim()}>
      {sidebar}
      <Backdrop />
      <div
        style={{ transitionDuration: uiStore.isSidebarVisible ? "340ms" : "280ms" }}
        className={`flex min-w-0 ${pantallaFija ? "h-screen overflow-hidden" : "min-h-screen"} flex-1 flex-col transition-[margin-left] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
          uiStore.isSidebarVisible ? "xl:ml-[290px]" : "xl:ml-[72px]"
        }`}
      >
        {/* Header as a floating rounded panel */}
        <div className={`shrink-0 ${pantallaFija ? "px-4 pt-3 md:px-6 md:pt-3.5" : "px-4 pt-4 md:px-6 md:pt-6"}`}>
          {header}
        </div>

        {/* Main content wrapped inside floating .necto-panel */}
        <main className={`min-w-0 flex-1 flex flex-col ${pantallaFija ? "px-4 pt-2.5 pb-3.5 md:px-6 md:pt-3 md:pb-4 min-h-0 overflow-hidden" : "px-4 py-4 md:px-6 md:py-6"}`}>
          {noCard ? (
            <div className={pantallaFija ? "flex-1 min-h-0 flex flex-col overflow-hidden" : "min-h-full flex-1 flex flex-col"}>
              {children}
            </div>
          ) : (
            <div className={`necto-panel animate-aparecer min-w-0 flex-1 flex flex-col ${pantallaFija ? "p-3.5 sm:p-4.5 lg:p-5 min-h-0 overflow-hidden" : "p-5 sm:p-6"}`}>
              {children}
            </div>
          )}
        </main>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 px-4 pb-4 md:px-6 md:pb-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
});

export default BaseAppShell;
