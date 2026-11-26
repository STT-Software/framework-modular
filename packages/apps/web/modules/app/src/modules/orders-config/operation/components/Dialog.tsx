import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/utils";

export function Modal({
  isOpen,
  onClose,
  className,
  children,
  label,
}: {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [isOpen]);

  return (
    <dialog
      ref={ref}
      aria-label={label ?? "Formulario de gestión"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          onClose();
        }
      }}
      className={cn(
        "m-auto max-h-[92dvh] w-[min(94vw,42rem)] overflow-y-auto rounded-2xl bg-white text-gray-900 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px] dark:bg-gray-900 dark:text-white",
        className,
      )}
    >
      {children}
    </dialog>
  );
}
