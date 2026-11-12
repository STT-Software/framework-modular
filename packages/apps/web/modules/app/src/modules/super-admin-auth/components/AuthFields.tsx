import { useState } from "react";
import { Input } from "@/elements/form/input";
import { Label } from "@/elements/form/label";
import { cn } from "@/utils";

interface FieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  /** Mensaje de error; si existe, el campo se pinta en estado de error. */
  error?: string | null;
  autoComplete?: string;
  maxLength?: number;
}

/** Acabado Necto sobre el Input de Elements: más alto y con foco índigo. */
function inputClassName(hasError: boolean, extra?: string) {
  return cn(
    "h-12 text-[15px] shadow-[0_1px_2px_#10182805] dark:shadow-none dark:bg-gray-800/50 dark:placeholder:text-gray-400",
    !hasError &&
      "focus:border-necto focus:ring-necto/10 dark:focus:border-necto-link dark:focus:ring-necto-link/20",
    extra,
  );
}

const labelClassName = "mb-2 text-gray-700 dark:text-gray-300";

export function TextField({
  id,
  name,
  label,
  value,
  placeholder,
  onChange,
  error,
  autoComplete,
  maxLength,
  type = "text",
}: FieldProps & { type?: "text" | "email" }) {
  return (
    <div>
      <Label htmlFor={id} className={labelClassName}>
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        error={Boolean(error)}
        hint={error ?? undefined}
        autoComplete={autoComplete}
        maxLength={maxLength}
        className={inputClassName(Boolean(error))}
      />
    </div>
  );
}

export function PasswordField({
  id,
  name,
  label,
  value,
  placeholder,
  onChange,
  error,
  autoComplete,
}: FieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <Label htmlFor={id} className={labelClassName}>
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          error={Boolean(error)}
          hint={error ?? undefined}
          autoComplete={autoComplete}
          className={inputClassName(Boolean(error), "pr-12")}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className="absolute right-1 top-0 flex h-12 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-necto dark:hover:text-necto-link"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
            {visible && (
              <path d="m4 4 16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}
