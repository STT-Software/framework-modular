import { observer } from "mobx-react-lite";
import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useMatch, useNavigate } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { Skeleton, SkeletonGroup } from "@/components/skeleton";
import { businessesStore, categoryLabel, initialsOf, type Business } from "@/modules/businesses";
import { ShellDropdown } from "@/shell";
import { cn } from "@/utils";
import { editBusinessPath, NEW_BUSINESS_PATH, WORKSPACE_PATH } from "../paths";
import { useWorkspaceDetail } from "./WorkspaceDetailContext";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 18 20"
      fill="none"
      aria-hidden="true"
      className={cn(
        "shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-200",
        open && "rotate-180",
      )}
    >
      <path
        d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GearIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StorePlusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 10v10h9M3 4h18l1 6a3 3 0 0 1-5 1 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5-1l1-6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 14v6M15 17h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Top-bar business portfolio switcher for SuperAdmin workspace routes.
 * Displays the active context (workspace root or edited business) and opens a quick
 * portfolio menu to inspect any business detail, jump to its editor, or create a new one.
 */
export const WorkspaceBusinessSwitcher = observer(() => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const isWorkspaceRoot = Boolean(useMatch({ path: WORKSPACE_PATH, end: true }));
  const editMatch = useMatch("/workspace/businesses/:id/edit");
  const { inspectedBusiness, openBusinessDetail, closeBusinessDetail } = useWorkspaceDetail();

  const editingBusinessId = editMatch?.params.id ?? null;
  const activeBusinessId = inspectedBusiness?.id ?? editingBusinessId;

  const editingBusiness: Business | null = editingBusinessId
    ? businessesStore.switcherItems.find((item) => item.id === editingBusinessId) ??
      businessesStore.items.find((item) => item.id === editingBusinessId) ??
      null
    : null;

  // Hydrate (or refresh after invalidation) the edited business in the pill when on /edit.
  useEffect(() => {
    if (editingBusinessId) {
      void businessesStore.loadSwitcher();
    }
  }, [editingBusinessId]);

  // Close the menu on any route transition (including browser Back/Forward).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const { switcherItems, switcherTotal, switcherState, switcherError, count } = businessesStore;
  const totalCount = count ?? (switcherState === "ready" ? switcherTotal : null);
  const isRootActive = isWorkspaceRoot && activeBusinessId === null;

  const closeMenu = () => setOpen(false);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void businessesStore.loadSwitcher();
  };

  const handleGoToWorkspace = () => {
    closeMenu();
    closeBusinessDetail();
    navigate(WORKSPACE_PATH);
  };

  const handleInspectBusiness = (business: Business) => {
    closeMenu();
    openBusinessDetail(business);
  };

  const handleEditBusiness = (business: Business) => {
    closeMenu();
    closeBusinessDetail();
    navigate(editBusinessPath(business.id));
  };

  const handleCreateBusiness = () => {
    closeMenu();
    closeBusinessDetail();
    navigate(NEW_BUSINESS_PATH);
  };

  return (
    <div className="relative hidden sm:block shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className={cn(
          "flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-colors cursor-pointer select-none",
          open
            ? "border-secondary-600/30 bg-gray-100/90 dark:border-white/20 dark:bg-white/[0.08]"
            : "border-gray-200/80 bg-gray-50/70 hover:bg-gray-100/80 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]",
        )}
      >
        {editingBusiness ? (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold",
                editingBusiness.status === "paused"
                  ? "bg-gray-200/80 text-gray-600 dark:bg-white/10 dark:text-gray-400"
                  : "bg-secondary-600/10 text-secondary-600 dark:bg-white/10 dark:text-white",
              )}
            >
              {initialsOf(editingBusiness.name)}
            </span>
            <span className="leading-tight min-w-0">
              <span className="block max-w-[160px] truncate text-xs font-semibold text-gray-900 dark:text-white">
                {editingBusiness.name}
              </span>
              <span className="block text-[10px] text-gray-500 dark:text-gray-400">
                Editando negocio
              </span>
            </span>
          </>
        ) : (
          <>
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-gray-200/70 bg-white dark:border-white/10 dark:bg-gray-800 dark:[&_path[fill='#190088']]:fill-white"
            >
              <NectoLogo variant="mark" width={14} height={14} />
            </span>
            <span className="leading-tight min-w-0">
              <span className="block text-xs font-semibold text-gray-900 dark:text-white">
                Mi workspace
              </span>
              <span className="block text-[10px] text-gray-500 dark:text-gray-400">
                Administración
              </span>
            </span>
          </>
        )}
        <ChevronIcon open={open} />
      </button>

      <ShellDropdown
        id={menuId}
        role="menu"
        aria-label="Selector de negocios del workspace"
        isOpen={open}
        onClose={closeMenu}
        triggerRef={triggerRef}
        className="absolute left-0 right-auto mt-3.5 flex w-80 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-gray-200/90 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900 z-50 font-sans animate-entrada-menu"
      >
        {/* Root workspace context */}
        <button
          type="button"
          role="menuitem"
          onClick={handleGoToWorkspace}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors cursor-pointer",
            isRootActive
              ? "bg-gray-100/90 dark:bg-white/[0.07]"
              : "hover:bg-gray-100/70 dark:hover:bg-white/[0.05]",
          )}
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200/80 bg-white dark:border-white/10 dark:bg-gray-800 dark:[&_path[fill='#190088']]:fill-white"
          >
            <NectoLogo variant="mark" width={15} height={15} />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-xs font-semibold text-gray-900 dark:text-white">
              Mi workspace
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-gray-500 dark:text-gray-400">
              {totalCount !== null ? `Todos los negocios · ${totalCount}` : "Todos los negocios"}
            </span>
          </span>
          {isRootActive && (
            <CheckIcon className="h-3.5 w-3.5 shrink-0 text-brand-500 dark:text-brand-400" />
          )}
        </button>

        <div role="separator" className="my-1.5 border-t border-gray-100 dark:border-gray-800" />

        <div className="px-2.5 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider uppercase text-gray-400 dark:text-gray-500">
          NEGOCIOS PROPIOS
        </div>

        {switcherState === "loading" && switcherItems.length === 0 && (
          <SkeletonGroup label="Cargando tus negocios" className="space-y-1 px-1.5 py-1">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex items-center gap-2.5 py-1.5 px-1" aria-hidden="true">
                <Skeleton width={32} height={32} radius={8} />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Skeleton width="68%" height={11} radius={4} />
                  <Skeleton width="44%" height={9} radius={4} />
                </div>
              </div>
            ))}
          </SkeletonGroup>
        )}

        {switcherState === "error" && switcherItems.length === 0 && (
          <div role="alert" className="px-2.5 py-3 text-center">
            <p className="text-xs text-error-700 dark:text-error-400">
              {switcherError || "No pudimos cargar tus negocios."}
            </p>
            <button
              type="button"
              onClick={() => void businessesStore.loadSwitcher(true)}
              className="mt-2 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold text-secondary-600 hover:bg-gray-100 dark:text-accent-300 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {switcherState === "ready" && switcherItems.length === 0 && (
          <p className="px-2.5 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
            Aún no tienes negocios creados.
          </p>
        )}

        {switcherItems.length > 0 && (
          <>
            {switcherState === "error" && (
              <div
                role="alert"
                className="mb-1 flex items-center justify-between gap-2 rounded-lg bg-error-50 px-2.5 py-1.5 text-[11px] text-error-700 dark:bg-error-500/10 dark:text-error-400"
              >
                <span className="truncate">{switcherError || "No pudimos cargar tus negocios."}</span>
                <button
                  type="button"
                  onClick={() => void businessesStore.loadSwitcher(true)}
                  className="shrink-0 font-semibold underline cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            )}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {switcherItems.map((business) => {
                const isActive = business.id === activeBusinessId;
                const isPaused = business.status === "paused";
                return (
                  <div
                    key={business.id}
                    className={cn(
                      "flex items-center gap-1 rounded-xl px-1.5 py-1 transition-colors",
                      isActive
                        ? "bg-gray-100/90 dark:bg-white/[0.07]"
                        : "hover:bg-gray-100/70 dark:hover:bg-white/[0.05]",
                    )}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleInspectBusiness(business)}
                      className="flex flex-1 min-w-0 items-center gap-2.5 rounded-lg px-1 py-1 text-left cursor-pointer"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold",
                          isPaused
                            ? "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
                            : "bg-secondary-600/10 text-secondary-600 dark:bg-white/10 dark:text-white",
                        )}
                      >
                        {initialsOf(business.name)}
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span
                          className={cn(
                            "block truncate text-xs font-semibold",
                            isPaused
                              ? "text-gray-600 dark:text-gray-300"
                              : "text-gray-900 dark:text-white",
                          )}
                        >
                          {business.name}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 min-w-0">
                          <span className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                            {categoryLabel(business.category, business.categoryOther)}
                          </span>
                          {isPaused && (
                            <span className="shrink-0 rounded-full bg-warning-50 px-1.5 py-0.5 text-[9px] font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-300">
                              Pausado
                            </span>
                          )}
                        </span>
                      </span>
                    </button>

                    {isActive && (
                      <CheckIcon className="h-3.5 w-3.5 shrink-0 text-brand-500 dark:text-brand-400" />
                    )}

                    <button
                      type="button"
                      role="menuitem"
                      aria-label={`Editar ${business.name}`}
                      title="Editar negocio"
                      onClick={() => handleEditBusiness(business)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200 cursor-pointer"
                    >
                      <GearIcon />
                    </button>
                  </div>
                );
              })}
            </div>

            {switcherTotal > switcherItems.length && (
              <button
                type="button"
                role="menuitem"
                onClick={handleGoToWorkspace}
                className="mt-1 flex w-full items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-secondary-600 hover:bg-gray-100 dark:text-accent-300 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Ver todos los negocios ({switcherTotal})
              </button>
            )}
          </>
        )}

        <div role="separator" className="my-1.5 border-t border-gray-100 dark:border-gray-800" />

        <button
          type="button"
          role="menuitem"
          onClick={handleCreateBusiness}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-secondary-600 hover:bg-gray-100 dark:text-accent-300 dark:hover:bg-white/5 transition-colors cursor-pointer"
        >
          <StorePlusIcon className="h-4 w-4 shrink-0" />
          <span>Crear nuevo negocio</span>
        </button>
      </ShellDropdown>
    </div>
  );
});

export default WorkspaceBusinessSwitcher;
