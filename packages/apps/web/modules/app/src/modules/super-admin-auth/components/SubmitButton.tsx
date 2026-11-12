import type { ReactNode } from "react";
import { Button } from "@/elements/ui/button";

interface SubmitButtonProps {
  children: ReactNode;
  loading?: boolean;
}

/** Botón principal de los formularios: Button de Elements con el acabado Necto. */
export function SubmitButton({ children, loading = false }: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      loading={loading}
      className="sa-submit group flex h-12 w-full gap-3 bg-necto text-sm shadow-[0_3px_6px_#19008812] hover:bg-necto-hover disabled:bg-necto/60 dark:bg-necto-dark dark:shadow-[0_3px_12px_#00000020] dark:hover:bg-necto-dark-hover dark:disabled:bg-necto-dark/60"
      endIcon={
        <svg
          className="sa-arrow"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 12h14m-5-5 5 5-5 5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
    >
      {children}
    </Button>
  );
}
