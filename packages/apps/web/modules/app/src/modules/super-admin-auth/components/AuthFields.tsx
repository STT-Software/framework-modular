import { useState } from "react";
import { Input } from "@/elements/form/input";
import { Label } from "@/elements/form/label";
import { Select } from "@/elements/form/select";
import { cn } from "@/utils";
import { DOCUMENT_TYPE_OPTIONS, type DocumentType } from "../documentTypes";

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
    "h-12 text-[14px] font-normal text-[#212121] shadow-[0_1px_2px_#10182805] dark:shadow-none dark:bg-gray-800/50 dark:text-[#ECECEC] dark:placeholder:text-[#ECECEC]/40",
    !hasError &&
      "focus:border-[#190088] focus:ring-[#190088]/10 dark:focus:border-[#97D6DF] dark:focus:ring-[#97D6DF]/20",
    extra,
  );
}

const labelClassName = "mb-2 text-[14px] font-bold text-[#212121] dark:text-[#ECECEC]";

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
          className="absolute right-1 top-0 flex h-12 w-11 items-center justify-center rounded-lg text-[#212121]/60 hover:text-[#190088] dark:text-[#ECECEC]/60 dark:hover:text-[#97D6DF]"
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

interface DocumentFieldProps {
  documentType: DocumentType;
  onDocumentTypeChange: (value: DocumentType) => void;
  documentNumber: string;
  onDocumentNumberChange: (value: string) => void;
  error?: string | null;
}

/** Documento de identidad: selector del tipo de documento y campo para el número. */
export function DocumentField({
  documentType,
  onDocumentTypeChange,
  documentNumber,
  onDocumentNumberChange,
  error,
}: DocumentFieldProps) {
  return (
    <div>
      <Label htmlFor="register-document" className={labelClassName}>
        Documento de identidad
      </Label>
      <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
        <Select
          name="identityDocumentType"
          aria-label="Tipo de documento"
          options={DOCUMENT_TYPE_OPTIONS}
          defaultValue={documentType}
          onChange={(value) => onDocumentTypeChange(value as DocumentType)}
          className={cn(
            "h-12 text-[14px] font-normal text-[#212121] shadow-[0_1px_2px_#10182805] dark:shadow-none dark:bg-gray-800/50 dark:text-[#ECECEC]",
            "focus:border-[#190088] focus:ring-[#190088]/10 dark:focus:border-[#97D6DF] dark:focus:ring-[#97D6DF]/20",
          )}
        />
        <Input
          id="register-document"
          name="identityDocument"
          value={documentNumber}
          placeholder="Número de documento"
          onChange={(event) => onDocumentNumberChange(event.target.value)}
          error={Boolean(error)}
          hint={error ?? undefined}
          maxLength={25}
          className={inputClassName(Boolean(error))}
        />
      </div>
    </div>
  );
}
