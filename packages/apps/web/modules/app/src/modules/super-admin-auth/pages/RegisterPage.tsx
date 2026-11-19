import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { Alert } from "@/elements/ui/alert";
import { PageMeta } from "@/shell/meta";
import {
  superAdminAuthApi,
  SuperAdminAuthError,
  type LoginResult,
  type PendingRegistration,
  type RegisterField,
  type RegisterInput,
} from "../api/superAdminAuthApi";
import { AuthCrossLinks } from "../components/AuthCrossLinks";
import { DocumentField, PasswordField, TextField } from "../components/AuthFields";
import { FormHeading } from "../components/FormHeading";
import { RegisterCodeStep } from "../components/RegisterCodeStep";
import { SubmitButton } from "../components/SubmitButton";
import { TermsCheckbox } from "../components/TermsCheckbox";
import type { AuthLayoutContext } from "../SuperAdminAuthLayout";
import { superAdminSessionStore } from "../stores/superAdminSession.store";
import { DEFAULT_DOCUMENT_TYPE, type DocumentType } from "../documentTypes";
import {
  normalizeIdentityDocument,
  normalizeUsername,
  validateEmail,
  validateIdentityDocument,
  validateNewPassword,
  validatePasswordConfirmation,
  validateTermsAccepted,
  validateUsername,
} from "../validation";

type FieldErrors = Partial<Record<RegisterField | "password" | "passwordConfirmation" | "terms", string | null>>;

const CONFLICT_MESSAGES: Record<RegisterField, string> = {
  username: "Ya existe una cuenta con ese usuario.",
  email: "Ya existe una cuenta con ese correo.",
  identityDocument: "Ya existe una cuenta con ese documento de identidad.",
};

function registerFormError(error: unknown): string {
  if (error instanceof SuperAdminAuthError) {
    switch (error.kind) {
      case "too-many-codes":
        return "Enviamos demasiados códigos a este correo. Espera unos minutos e inténtalo de nuevo.";
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

/**
 * Registro en dos pasos: el formulario y luego el código de 6 dígitos enviado al correo. Los datos del formulario
 * (contraseña incluida) viven solo en el estado de esta página, nunca en storage: "Cambiar correo" vuelve al
 * formulario con todo intacto y, si el registro pendiente venció, se vuelve a registrar con los mismos datos.
 */
export default function RegisterPage() {
  const navigate = useNavigate();
  const { setCodeStep } = useOutletContext<AuthLayoutContext>();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [email, setEmail] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>(DEFAULT_DOCUMENT_TYPE);
  const [identityDocument, setIdentityDocument] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingRegistration | null>(null);

  // The brand panel shows the code scene while the code step is on screen.
  useEffect(() => {
    setCodeStep(pending !== null);
    return () => setCodeStep(false);
  }, [pending, setCodeStep]);

  function registerInput(): RegisterInput {
    return {
      username: normalizeUsername(username),
      email: email.trim().toLowerCase(),
      password,
      identityDocumentType: documentType,
      identityDocument: normalizeIdentityDocument(identityDocument),
      acceptTerms,
    };
  }

  function showConflict(error: SuperAdminAuthError) {
    setPending(null);
    if (error.field) setErrors({ [error.field]: CONFLICT_MESSAGES[error.field] });
    else setFormError(registerFormError(error));
  }

  function handleVerified(result: LoginResult) {
    superAdminSessionStore.signIn(result);
    navigate("/welcome", { replace: true });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const nextErrors: FieldErrors = {
      username: validateUsername(username),
      password: validateNewPassword(password),
      passwordConfirmation: validatePasswordConfirmation(password, passwordConfirmation),
      email: validateEmail(email),
      identityDocument: validateIdentityDocument(identityDocument),
      terms: validateTermsAccepted(acceptTerms),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setLoading(true);
    try {
      setPending(await superAdminAuthApi.register(registerInput()));
    } catch (error) {
      if (error instanceof SuperAdminAuthError && error.kind === "conflict" && error.field) {
        showConflict(error);
      } else {
        setFormError(registerFormError(error));
      }
    } finally {
      setLoading(false);
    }
  }

  if (pending) {
    return (
      <>
        <PageMeta title="Necto · Verifica tu correo" />
        <RegisterCodeStep
          pending={pending}
          onPendingChange={setPending}
          onVerified={handleVerified}
          onChangeEmail={() => setPending(null)}
          onRestart={() => superAdminAuthApi.register(registerInput())}
          onConflict={showConflict}
        />
      </>
    );
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
        <PasswordField
          id="register-password-confirmation"
          name="passwordConfirmation"
          label="Confirmar contraseña"
          placeholder="Repite tu contraseña"
          value={passwordConfirmation}
          onChange={setPasswordConfirmation}
          error={errors.passwordConfirmation}
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
        <DocumentField
          documentType={documentType}
          onDocumentTypeChange={setDocumentType}
          documentNumber={identityDocument}
          onDocumentNumberChange={setIdentityDocument}
          error={errors.identityDocument}
        />
        <TermsCheckbox checked={acceptTerms} onChange={setAcceptTerms} error={errors.terms} />
        <SubmitButton loading={loading}>Crear cuenta</SubmitButton>
      </form>

      {formError && (
        <div className="mt-5" aria-live="polite">
          <Alert variant="error" title="No pudimos crear la cuenta" message={formError} />
        </div>
      )}

      <AuthCrossLinks
        prompt="¿Ya tienes una cuenta?"
        actionLabel="Inicia sesión"
        to="/super/login"
        className="mt-6"
      />
    </section>
  );
}
