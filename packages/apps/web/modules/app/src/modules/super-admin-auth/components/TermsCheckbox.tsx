import { Link } from "react-router";
import { Checkbox } from "@/elements/form/checkbox";

/**
 * Ruta de la vista de términos y condiciones. Está vacía porque esa vista todavía no
 * existe: mientras tanto el enlace se muestra pero no navega. Al crear la vista,
 * basta con poner aquí su ruta (por ejemplo "/super/terms") y se abrirá en otra
 * pestaña para no perder lo que la persona ya escribió en el formulario.
 */
const TERMS_PATH = "";

interface TermsCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string | null;
}

const linkClassName = "font-bold text-[#190088] hover:underline dark:text-[#97D6DF]";

/** Casilla "Acepto los términos y condiciones", con enlace a la vista de términos. */
export function TermsCheckbox({ checked, onChange, error }: TermsCheckboxProps) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <Checkbox
          id="register-terms"
          name="acceptTerms"
          checked={checked}
          onChange={onChange}
          className="checked:bg-[#190088] dark:checked:bg-[#FF3F1A]"
        />
        <label
          htmlFor="register-terms"
          className="cursor-pointer text-[14px] font-normal leading-5 text-[#212121] dark:text-[#ECECEC]"
        >
          Acepto los{" "}
          {TERMS_PATH ? (
            <Link to={TERMS_PATH} target="_blank" rel="noopener noreferrer" className={linkClassName}>
              términos y condiciones
            </Link>
          ) : (
            <a href="#" onClick={(event) => event.preventDefault()} className={linkClassName}>
              términos y condiciones
            </a>
          )}
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-error-500">
          {error}
        </p>
      )}
    </div>
  );
}
