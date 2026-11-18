import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { Alert } from "@/elements/ui/alert";
import { Button } from "@/elements/ui/button";
import type { Profile } from "../api/onboardingApi";
import { ProfileGate } from "../components/ProfileGate";
import { ProfileSetupLayout } from "../components/ProfileSetupLayout";
import { nextOnboardingPath } from "../flow";
import { isPhoneRequiredError, PHONE_REQUIRED_MESSAGE, serviceErrorMessage } from "../serviceErrors";
import { PHONE_STEP_PATH, READY_STEP_PATH, SOURCE_STEP_PATH } from "../paths";
import { SOURCE_OPTIONS, SourceIcon, type SourceId } from "../sources";
import { SourceArt } from "../scenes/SetupArt";
import { onboardingProfileStore } from "../stores/onboardingProfile.store";

const HEADING_ID = "source-heading";
/** Cuánto se ve el "¡Listo!" antes de pasar a la pantalla final. */
const ENTER_READY_DELAY_MS = 1500;

/** "Elige una opción." / "1 opción seleccionada." (el servicio acepta como máximo una). */
function selectionNote(total: number): string {
  return total === 0 ? "Elige una opción." : "1 opción seleccionada.";
}

type Phase = "editing" | "saving" | "done";

function SourceForm({ initialSources }: { initialSources: SourceId[] }) {
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstChoiceRef = useRef<HTMLInputElement>(null);
  // Perfiles antiguos pueden traer varias fuentes; el servicio ahora acepta una sola, así que se conserva la primera.
  const [selected, setSelected] = useState<SourceId[]>(initialSources.slice(0, 1));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("editing");

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  // Con el perfil guardado se muestra "¡Listo!" un momento y se pasa a la pantalla final (que lleva al workspace).
  useEffect(() => {
    if (phase !== "done") return;
    const timer = window.setTimeout(() => navigate(READY_STEP_PATH, { replace: true }), ENTER_READY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [phase, navigate]);

  /** Selección única: marcar una opción reemplaza la anterior; marcar la misma la quita. */
  function toggle(id: SourceId) {
    setSelected((current) => (current.includes(id) ? [] : [id]));
    setFieldError(null);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (phase !== "editing") return;
    if (selected.length === 0) {
      setFieldError("Selecciona al menos una opción para continuar.");
      firstChoiceRef.current?.focus();
      return;
    }
    setFieldError(null);
    setFormError(null);
    setPhase("saving");
    try {
      await onboardingProfileStore.saveSources(selected.slice(0, 1));
      setPhase("done");
    } catch (error) {
      if (isPhoneRequiredError(error)) {
        // El servicio no tiene el teléfono (la copia en memoria estaba vieja): se olvida y se vuelve al paso 1 con un aviso.
        onboardingProfileStore.invalidate();
        navigate(PHONE_STEP_PATH, { replace: true, state: { notice: PHONE_REQUIRED_MESSAGE } });
        return;
      }
      setFormError(serviceErrorMessage(error));
      setPhase("editing");
    }
  }

  const busy = phase !== "editing";

  return (
    <>
      <h1 id={HEADING_ID} ref={headingRef} tabIndex={-1}>
        ¿Dónde nos conociste?
      </h1>
      <p className="ob-setup-description">Cuéntanos cómo llegaste a Necto.</p>
      <form onSubmit={handleSubmit} noValidate className="ob-setup-form">
        <fieldset className="ob-setup-sources" aria-describedby={fieldError ? "source-error" : undefined} disabled={busy}>
          <legend>Elige la opción que mejor te describa.</legend>
          <div className="ob-setup-choice-grid">
            {SOURCE_OPTIONS.map((option, index) => (
              <label key={option.id} className="ob-setup-choice">
                <input
                  ref={index === 0 ? firstChoiceRef : undefined}
                  type="checkbox"
                  name="source"
                  value={option.id}
                  checked={selected.includes(option.id)}
                  onChange={() => toggle(option.id)}
                />
                <span className="ob-setup-app-icon" aria-hidden="true">
                  <SourceIcon id={option.id} />
                </span>
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="ob-setup-selection-note" role="status" aria-live="polite">
          {selectionNote(selected.length)}
        </div>
        {fieldError && (
          <p id="source-error" className="ob-setup-error" role="alert">
            {fieldError}
          </p>
        )}
        {formError && (
          <div className="ob-setup-alert" aria-live="polite">
            <Alert variant="error" title="No pudimos guardar tus respuestas" message={formError} />
          </div>
        )}
        <div className="ob-setup-actions">
          <Link className="ob-setup-back" to={PHONE_STEP_PATH}>
            <span aria-hidden="true">←</span> Volver
          </Link>
          <Button type="submit" loading={phase === "saving"} disabled={phase === "done"} className="ob-setup-primary">
            {phase === "done" ? (
              "Completado ✓"
            ) : (
              <>
                Finalizar <span aria-hidden="true">→</span>
              </>
            )}
          </Button>
        </div>
        {phase === "done" && (
          <p className="ob-setup-success" role="status">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            ¡Listo! Gracias por contarnos.
          </p>
        )}
      </form>
    </>
  );
}

/**
 * Decide con el perfil tal como estaba al abrir la pantalla (una foto, no el valor en vivo):
 * al guardar, el perfil pasa a "completo" y eso no debe sacar a la persona antes de ver el "¡Listo!".
 */
function SourceStep({ loaded }: { loaded: Profile }) {
  const [initial] = useState(loaded);
  const next = nextOnboardingPath(initial);
  if (next !== SOURCE_STEP_PATH) return <Navigate to={next} replace />;
  return <SourceForm initialSources={initial.sources} />;
}

/** Paso 2 de 2: dónde nos conociste. Sin teléfono guardado vuelve al paso 1. */
export default function SourceStepPage() {
  return (
    <ProfileSetupLayout
      step={2}
      title="Necto · Dónde nos conociste"
      headingId={HEADING_ID}
      width="wide"
      art={<SourceArt />}
      caption="Cada canal cuenta. Así sabemos dónde seguir creciendo contigo."
    >
      <ProfileGate>{(profile) => <SourceStep loaded={profile} />}</ProfileGate>
    </ProfileSetupLayout>
  );
}
