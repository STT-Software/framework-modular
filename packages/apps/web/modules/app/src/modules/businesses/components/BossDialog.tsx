import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Input } from "@/elements/form/input";
import { Label } from "@/elements/form/label";
import { validateBoss } from "../draft";

interface BossDialogProps {
  open: boolean;
  /** The boss already chosen, to edit it. */
  initial: { name: string; email: string } | null;
  onSave: (boss: { name: string; email: string }) => void;
  onClose: () => void;
}

/** Asks for the name and email of the person who will run the business. Nothing is sent from here. */
export function BossDialog({ open, initial, onSave, onClose }: BossDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const baseId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const nameId = `${baseId}-name`;
  const emailId = `${baseId}-email`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setName(initial?.name ?? "");
      setEmail(initial?.email ?? "");
      setErrors({});
      dialog.showModal();
      document.getElementById(nameId)?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, initial, nameId]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateBoss({ name, email });
    setErrors(found);
    if (found.name || found.email) {
      document.getElementById(found.name ? nameId : emailId)?.focus();
      return;
    }
    onSave({ name: name.trim(), email: email.trim().toLowerCase() });
  }

  return (
    <dialog
      ref={dialogRef}
      className="bs-dialog bs-leader-dialog"
      aria-labelledby={`${baseId}-title`}
      aria-describedby={`${baseId}-description`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <button type="button" className="bs-dialog-close ws-icon-button" aria-label="Cerrar asignación" onClick={() => dialogRef.current?.close()}>
        <span aria-hidden="true">×</span>
      </button>
      <div className="bs-dialog-symbol" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="10" cy="7" r="4" />
          <path d="M3 21v-3a7 7 0 0 1 14 0v3m2-10v6m-3-3h6" />
        </svg>
      </div>
      <span className="ws-eyebrow">ALGUIEN QUE CONECTE</span>
      <h2 id={`${baseId}-title`}>Asigna al jefe de negocio</h2>
      <p id={`${baseId}-description`} className="bs-dialog-description">
        Será la persona responsable de operar tu negocio. Su acceso será con correo y código OTP.
      </p>
      <form className="bs-leader-form" onSubmit={handleSubmit} noValidate>
        <div className="bs-field">
          <Label htmlFor={nameId}>
            Nombre completo <span className="bs-required">*</span>
          </Label>
          <Input
            id={nameId}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setErrors((current) => ({ ...current, name: undefined }));
            }}
            placeholder="Ej. Andrea Morales"
            autoComplete="name"
            maxLength={100}
            required
            error={Boolean(errors.name)}
            aria-describedby={errors.name ? `${nameId}-error` : undefined}
          />
          {errors.name && (
            <p id={`${nameId}-error`} className="bs-error">
              {errors.name}
            </p>
          )}
        </div>
        <div className="bs-field">
          <Label htmlFor={emailId}>
            Correo electrónico <span className="bs-required">*</span>
          </Label>
          <Input
            id={emailId}
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: undefined }));
            }}
            placeholder="andrea@tunegocio.com"
            autoComplete="email"
            maxLength={254}
            required
            error={Boolean(errors.email)}
            aria-describedby={errors.email ? `${emailId}-error` : undefined}
          />
          {errors.email && (
            <p id={`${emailId}-error`} className="bs-error">
              {errors.email}
            </p>
          )}
        </div>
        <div className="bs-dialog-actions">
          <button type="button" className="ws-secondary" onClick={() => dialogRef.current?.close()}>
            Cancelar
          </button>
          <button type="submit" className="ws-primary">
            Asignar jefe de negocio <span aria-hidden="true">→</span>
          </button>
        </div>
        <p className="bs-detail-description" style={{ textAlign: "center", margin: "15px 0 0", fontSize: 10 }}>
          Al guardar el negocio, le enviaremos un código de un solo uso a este correo.
        </p>
      </form>
    </dialog>
  );
}
