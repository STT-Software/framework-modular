import { useId, useRef, useState } from "react";
import { categoryLabel, initialsOf } from "@/modules/businesses";
import { ShellDropdown } from "@/shell";
import { cn } from "@/utils";

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

export interface ConfigBusinessSwitcherItem {
  id: string;
  name: string;
  category?: string;
  categoryOther?: string | null;
}

export interface ConfigBusinessSwitcherProps {
  currentBusinessId: string;
  currentBusinessName?: string;
  subtitle?: string;
  businesses: ConfigBusinessSwitcherItem[];
  onSelect?: (businessId: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Topbar business switcher for setup and configuration flows.
 * Adopts the Workspace business switcher pill design (initials badge, business name,
 * contextual subtitle, chevron and dropdown), tailored for selecting between administered businesses.
 */
export function ConfigBusinessSwitcher({
  currentBusinessId,
  currentBusinessName,
  subtitle = "Negocio activo",
  businesses,
  onSelect,
  disabled = false,
  className,
}: ConfigBusinessSwitcherProps) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const activeBusiness =
    businesses.find((b) => b.id === currentBusinessId) ??
    (currentBusinessName ? { id: currentBusinessId, name: currentBusinessName } : null);

  const displayName = currentBusinessName || activeBusiness?.name || "Tu negocio";
  const canSwitch = businesses.length > 1 && !disabled;

  const closeMenu = () => setOpen(false);

  const handleToggle = () => {
    if (!canSwitch) return;
    setOpen((prev) => !prev);
  };

  return (
    <div className={cn("relative inline-block shrink-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        title={canSwitch ? "Cambiar de negocio" : displayName}
        aria-label={`Negocio actual: ${displayName}`}
        className={cn(
          "flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-colors select-none",
          canSwitch ? "cursor-pointer" : "cursor-default",
          open
            ? "border-[#190088]/30 bg-gray-100/90 dark:border-white/20 dark:bg-white/[0.08]"
            : "border-gray-200/80 bg-gray-50/70 hover:bg-gray-100/80 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]",
          disabled && "opacity-60 cursor-not-allowed",
        )}
      >
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold bg-[#190088]/10 text-[#190088] dark:bg-white/10 dark:text-white"
        >
          {initialsOf(displayName)}
        </span>
        <span className="leading-tight min-w-0">
          <span className="block max-w-[140px] sm:max-w-[180px] truncate text-xs font-semibold text-gray-900 dark:text-white">
            {displayName}
          </span>
          <span className="block text-[10px] text-gray-500 dark:text-gray-400">
            {subtitle}
          </span>
        </span>
        {canSwitch && <ChevronIcon open={open} />}
      </button>

      {canSwitch && (
        <ShellDropdown
          id={menuId}
          role="menu"
          aria-label="Selector de negocios"
          isOpen={open}
          onClose={closeMenu}
          triggerRef={triggerRef}
          className="absolute left-0 right-auto mt-2.5 flex w-72 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-gray-200/90 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900 z-50 font-sans"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Mis negocios ({businesses.length})
          </div>
          <div className="flex flex-col gap-0.5 overflow-y-auto max-h-64">
            {businesses.map((business) => {
              const isSelected = business.id === currentBusinessId;
              return (
                <button
                  key={business.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeMenu();
                    onSelect?.(business.id);
                  }}
                  className={cn(
                    "flex items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors cursor-pointer",
                    isSelected
                      ? "bg-[#190088]/[0.08] text-[#190088] dark:bg-white/[0.08] dark:text-white font-medium"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200"
                    >
                      {initialsOf(business.name)}
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate text-xs font-semibold">
                        {business.name}
                      </span>
                      {business.category && (
                        <span className="block text-[10px] text-gray-400 dark:text-gray-500">
                          {categoryLabel(business.category as any, business.categoryOther ?? null) || business.category}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <CheckIcon className="h-4 w-4 text-[#ff3f1a] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </ShellDropdown>
      )}
    </div>
  );
}
