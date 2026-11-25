import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/utils";

export function Modal({ isOpen, onClose, className, children, label }: {
  isOpen: boolean; onClose: () => void; className?: string; children: ReactNode; label?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (isOpen) dialog?.showModal();
    return () => dialog?.close();
  }, [isOpen]);
  return <dialog ref={ref} aria-label={label ?? "Formulario de gestión"} onCancel={onClose}
    className={cn("m-auto max-h-[90dvh] w-[min(94vw,42rem)] overflow-y-auto rounded-2xl bg-white text-gray-900 shadow-xl backdrop:bg-black/50 dark:bg-gray-900 dark:text-white", className)}>
    {children}
  </dialog>;
}
