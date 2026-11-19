/**
 * ShellDropdown — Self-contained dropdown for the shell header.
 *
 * Inlines the Dropdown/DropdownItem pattern so the shell has zero
 * dependencies on @/elements/ui/dropdown. This is intentional duplication
 * to keep the shell fully self-contained and portable.
 */

import {
  useEffect,
  useRef,
  type AriaRole,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Link } from "react-router";

// ─── Dropdown Container ─────────────────────────────────────────────────────

interface ShellDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  triggerRef?: RefObject<HTMLElement | null>;
  id?: string;
  role?: AriaRole;
  "aria-label"?: string;
}

/**
 * @kgId 605c30bd3b40
 */
export function ShellDropdown({
  isOpen,
  onClose,
  children,
  className = "",
  triggerRef,
  id,
  role,
  "aria-label": ariaLabel,
}: ShellDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: globalThis.MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (ref.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      const element = target instanceof Element ? target : target.parentElement;
      if (element?.closest(".dropdown-toggle")) return;
      onCloseRef.current();
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCloseRef.current();
      triggerRef?.current?.focus();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, triggerRef]);

  if (!isOpen) return null;

  return (
    <div ref={ref} id={id} role={role} aria-label={ariaLabel} className={className}>
      {children}
    </div>
  );
}

// ─── Dropdown Item ──────────────────────────────────────────────────────────

interface ShellDropdownItemProps {
  tag?: "a" | "button";
  to?: string;
  onClick?: () => void;
  onItemClick?: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * @kgId 0b0278f3e84a
 */
export function ShellDropdownItem({
  tag = "button",
  to,
  onClick,
  onItemClick,
  className = "",
  children,
}: ShellDropdownItemProps) {
  const handleClick = (event: ReactMouseEvent) => {
    if (tag === "button") event.preventDefault();
    onClick?.();
    onItemClick?.();
  };

  if (tag === "a" && to) {
    return (
      <Link to={to} className={className} onClick={handleClick}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
