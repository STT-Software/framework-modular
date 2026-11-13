import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { Alert } from "@/elements/ui/alert";
import { Button } from "@/elements/ui/button";
import { Input } from "@/elements/form/input";
import { Label } from "@/elements/form/label";
import { Select } from "@/elements/form/select";
import { cn } from "@/utils";
import { OnboardingError, type Profile } from "../api/onboardingApi";
import { ProfileGate } from "../components/ProfileGate";
import { ProfileSetupLayout } from "../components/ProfileSetupLayout";
import { AFTER_ONBOARDING_PATH, SOURCE_STEP_PATH } from "../paths";
import { checkPhone, COUNTRIES, PHONE_FORMAT_ERROR, splitPhone } from "../phone";
import { serviceErrorMessage } from "../serviceErrors";
import { onboardingProfileStore } from "../stores/onboardingProfile.store";

const HEADING_ID = "phone-heading";
const COUNTRY_OPTIONS = COUNTRIES.map((country) => ({ value: country.dialCode, label: country.label }));

/** Texto de error del campo cuando el servicio rechaza el número. */
function phoneFieldError(error: unknown): string | null {
  if (error instanceof OnboardingError) {
    if (error.kind === "conflict") return "Este número ya está registrado con otra cuenta. Usa otro número.";
    if (error.kind === "validation") return PHONE_FORMAT_ERROR;
  }
  return null;
}

function PhoneForm({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const initial = splitPhone(profile.phone);
  const [dialCode, setDialCode] = useState(initial.dialCode);
  const [number, setNumber] = useState(initial.number);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  function clearErrors() {
    setFieldError(null);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    clearErrors();
    const check = checkPhone(dialCode, number);
    if (!check.e164) {
      setFieldError(check.error);
      document.getElementById("profile-phone")?.focus();
      return;
    }
    setSaving(true);
    try {
      await onboardingProfileStore.savePhone(check.e164);
      navigate(SOURCE_STEP_PATH);
    } catch (error) {
      const message = phoneFieldError(error);
      if (message) {
        setFieldError(message);
        document.getElementById("profile-phone")?.focus();
      } else {
        setFormError(serviceErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="ob-setup-symbol" aria-hidden="true">
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none">
          <rect x="6.5" y="2.5" width="11" height="19" rx="3" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 5h4m-3 13.5h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <h1 id={HEADING_ID} ref={headingRef} tabIndex={-1}>
        ¿Cuál es tu número
        <br />
        de teléfono?
      </h1>
      <p className="ob-setup-description">Agrega un número de contacto a tu perfil.</p>
      <form onSubmit={handleSubmit} noValidate className="ob-setup-form">
        <Label htmlFor="profile-phone" className="ob-setup-field-label">
          Número de teléfono
        </Label>
        <div className={cn("ob-setup-phone-control", fieldError && "is-invalid")}>
          <div className="ob-setup-country">
            <Select
              name="country"
              aria-label="País e indicativo"
              options={COUNTRY_OPTIONS}
              defaultValue={dialCode}
              onChange={(value) => {
                setDialCode(value);
                clearErrors();
              }}
            />
          </div>
          <Input
            id="profile-phone"
            name="phone"
            type="tel"
            placeholder="300 123 4567"
            value={number}
            onChange={(event) => {
              setNumber(event.target.value);
              clearErrors();
            }}
            autoComplete="tel-national"
            maxLength={25}
            error={Boolean(fieldError)}
            aria-describedby={fieldError ? "phone-hint phone-error" : "phone-hint"}
          />
        </div>
        <p id="phone-hint" className="ob-setup-hint">
          Selecciona tu país e ingresa el número sin el indicativo.
        </p>
        {fieldError && (
          <p id="phone-error" className="ob-setup-error" role="alert">
            {fieldError}
          </p>
        )}
        {formError && (
          <div className="ob-setup-alert" aria-live="polite">
            <Alert variant="error" title="No pudimos guardar tu número" message={formError} />
          </div>
        )}
        <Button type="submit" loading={saving} className="ob-setup-primary">
          Continuar <span aria-hidden="true">→</span>
        </Button>
      </form>
      <p className="ob-setup-step-note">Un paso más para conocernos mejor.</p>
    </>
  );
}

/** Paso 1 de 2: teléfono. Si el perfil ya está completo, entra directo al workspace. */
export default function PhoneStepPage() {
  return (
    <ProfileSetupLayout step={1} title="Necto · Tu teléfono" headingId={HEADING_ID} width="narrow">
      <ProfileGate>
        {(profile) =>
          profile.completed ? <Navigate to={AFTER_ONBOARDING_PATH} replace /> : <PhoneForm profile={profile} />
        }
      </ProfileGate>
    </ProfileSetupLayout>
  );
}
