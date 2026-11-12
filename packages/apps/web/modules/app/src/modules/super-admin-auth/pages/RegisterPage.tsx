import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Alert } from "@/elements/ui/alert";
import { PageMeta } from "@/shell/meta";
import {
  superAdminAuthApi,
  SuperAdminAuthError,
  type RegisterField,
} from "../api/superAdminAuthApi";
import { PasswordField, TextField } from "../components/AuthFields";
import { FormHeading } from "../components/FormHeading";
import { SubmitButton } from "../components/SubmitButton";
import {
  normalizeIdentityDocument,
  normalizeUsername,
  validateEmail,
  validateIdentityDocument,
  validateNewPassword,
  validateUsername,
} from "../validation";

type FieldErrors = Partial<Record<RegisterField | "password", string | null>>;

const CONFLICT_MESSAGES: Record<RegisterField, string> = {
  username: "Ya existe una cuenta con ese usuario.",
  email: "Ya existe una cuenta con ese correo.",
  identityDocument: "Ya existe una cuenta con ese documento de identidad.",
};

function registerFormError(error: unknown): string {
  if (error instanceof SuperAdminAuthError) {
    switch (error.kind) {
      case "rate-limited":
        return "Demasiados intentos. Espera un minuto e inténtalo de nuevo.";
      case "network":
      case "timeout":
        return "No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.";
      case "validation":
        return "Revisa los datos ingresados.";
      default:
        return "Ocurrió un problema en el servicio. Inténtalo de nuevo en unos minutos.";
    }
  }
  return "Ocurrió un error inesperado.";
}

export default function RegisterPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [identityDocument, setIdentityDocument] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const nextErrors: FieldErrors = {
      username: validateUsername(username),
      password: validateNewPassword(password),
      email: validateEmail(email),
      identityDocument: validateIdentityDocument(identityDocument),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setLoading(true);
    try {
      const created = await superAdminAuthApi.register({
        username: normalizeUsername(username),
        email: email.trim().toLowerCase(),
        password,
        identityDocument: normalizeIdentityDocument(identityDocument),
      });
      navigate("/super/login", { replace: true, state: { registeredUsername: created.username } });
    } catch (error) {
      if (error instanceof SuperAdminAuthError && error.kind === "conflict" && error.field) {
        setErrors({ [error.field]: CONFLICT_MESSAGES[error.field] });
      } else {
        setFormError(registerFormError(error));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="sa-fade-in" aria-labelledby="register-title">
      <PageMeta title="Necto · Crear cuenta" />
      <FormHeading
        id="register-title"
        eyebrow="EMPIEZA A CONECTAR"
        title="Crea tu cuenta"
        subtitle="Tu próxima conexión empieza aquí."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          id="register-username"
          name="username"
          label="Usuario"
          placeholder="Elige tu usuario"
          value={username}
          onChange={setUsername}
          error={errors.username}
          autoComplete="username"
          maxLength={30}
        />
        <PasswordField
          id="register-password"
          name="password"
          label="Contraseña"
          placeholder="Crea tu contraseña"
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="new-password"
        />
        <TextField
          id="register-email"
          name="email"
          type="email"
          label="Correo"
          placeholder="nombre@correo.com"
          value={email}
          onChange={setEmail}
          error={errors.email}
          autoComplete="email"
          maxLength={254}
        />
        <TextField
          id="register-document"
          name="identityDocument"
          label="Documento de identidad"
          placeholder="Ingresa tu número de documento"
          value={identityDocument}
          onChange={setIdentityDocument}
          error={errors.identityDocument}
          maxLength={25}
        />
        <SubmitButton loading={loading}>Crear cuenta</SubmitButton>
      </form>

      {formError && (
        <div className="mt-5" aria-live="polite">
          <Alert variant="error" title="No pudimos crear la cuenta" message={formError} />
        </div>
      )}

      <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
        ¿Ya tienes una cuenta?
        <Link to="/super/login" className="ml-1 font-semibold text-necto hover:underline dark:text-necto-link">
          Inicia sesión
        </Link>
      </p>
    </section>
  );
}
