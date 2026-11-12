import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Alert } from "@/elements/ui/alert";
import { PageMeta } from "@/shell/meta";
import { superAdminAuthApi, SuperAdminAuthError } from "../api/superAdminAuthApi";
import { PasswordField, TextField } from "../components/AuthFields";
import { FormHeading } from "../components/FormHeading";
import { SubmitButton } from "../components/SubmitButton";
import { superAdminSessionStore } from "../stores/superAdminSession.store";
import { validateIdentifier, validateLoginPassword } from "../validation";

/** Texto que ve el usuario según el tipo de error del servicio. */
function loginErrorMessage(error: unknown): string {
  if (error instanceof SuperAdminAuthError) {
    switch (error.kind) {
      case "unauthorized":
        return "Usuario o contraseña incorrectos.";
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

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const registeredUsername = (location.state as { registeredUsername?: string } | null)?.registeredUsername;

  const [identifier, setIdentifier] = useState(registeredUsername ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ identifier?: string | null; password?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const nextErrors = {
      identifier: validateIdentifier(identifier),
      password: validateLoginPassword(password),
    };
    setErrors(nextErrors);
    if (nextErrors.identifier || nextErrors.password) return;

    setLoading(true);
    try {
      const result = await superAdminAuthApi.login({ identifier: identifier.trim(), password });
      superAdminSessionStore.signIn(result);
      navigate("/", { replace: true });
    } catch (error) {
      setFormError(loginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="sa-fade-in" aria-labelledby="login-title">
      <PageMeta title="Necto · Iniciar sesión" />
      <FormHeading
        id="login-title"
        eyebrow="BIENVENIDO A NECTO"
        title="Inicia sesión"
        subtitle="Qué bueno verte. Sigamos conectando."
      />

      {registeredUsername && (
        <div className="mb-6">
          <Alert variant="success" title="Cuenta creada" message="Ya puedes iniciar sesión con tus datos." />
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="login-identifier"
          name="identifier"
          label="Usuario o correo"
          placeholder="Ingresa tu usuario o correo"
          value={identifier}
          onChange={setIdentifier}
          error={errors.identifier}
          autoComplete="username"
          maxLength={254}
        />
        <PasswordField
          id="login-password"
          name="password"
          label="Contraseña"
          placeholder="Ingresa tu contraseña"
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="current-password"
        />
        <SubmitButton loading={loading}>Iniciar sesión</SubmitButton>
      </form>

      {formError && (
        <div className="mt-5" aria-live="polite">
          <Alert variant="error" title="No pudimos iniciar sesión" message={formError} />
        </div>
      )}

      <p className="mt-7 text-sm text-gray-500 dark:text-gray-400">
        ¿Aún no tienes una cuenta?
        <Link to="/super/register" className="ml-1 font-semibold text-necto hover:underline dark:text-necto-link">
          Regístrate
        </Link>
      </p>
    </section>
  );
}
