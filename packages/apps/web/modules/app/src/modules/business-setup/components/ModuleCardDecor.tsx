interface ModuleCardDecorProps {
  variant: "a" | "b";
}

/**
 * Signature NECTO organic corner geometry tucked cleanly into the bottom-right
 * corner of each module card (cyan, vermilion, and warm cream curves).
 */
export function ModuleCardDecor({ variant }: ModuleCardDecorProps) {
  if (variant === "a") {
    return (
      <svg
        className="sh-card-decor"
        viewBox="0 0 180 84"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M22 84 C44 48, 86 38, 128 54 L142 84 Z"
          className="sh-decor-cyan"
        />
        <path
          d="M116 84 L126 30 C130 12, 144 6, 162 8 L180 10 L180 84 Z"
          className="sh-decor-orange"
        />
      </svg>
    );
  }

  return (
    <svg
      className="sh-card-decor"
      viewBox="0 0 180 84"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M34 84 C46 46, 86 24, 134 40 L152 84 Z"
        className="sh-decor-cream"
      />
      <path
        d="M100 84 C102 58, 120 42, 144 48 L152 84 Z"
        className="sh-decor-orange"
      />
      <path
        d="M140 84 L142 26 C144 10, 158 2, 174 4 L180 5 L180 84 Z"
        className="sh-decor-cyan"
      />
    </svg>
  );
}
