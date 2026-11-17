import { useEffect, useRef } from "react";

export type HelpKind = "access" | "code";

const CONTENT: Record<HelpKind, { title: string; paragraphs: string[] }> = {
  access: {
    title: "Tu acceso empieza con una invitación",
    paragraphs: [
      "Pide a tu superadministrador que te asigne como administrador de un negocio con tu nombre y correo.",
      "Después podrás entrar desde este acceso usando el código enviado a ese correo. No necesitas crear una contraseña.",
    ],
  },
  code: {
    title: "¿No encuentras tu código?",
    paragraphs: [
      "Comprueba que escribiste el correo que asignaron a tu negocio y revisa la carpeta de spam o correo no deseado.",
      "Espera a que se habilite Reenviar código. Si solicitaste varios, utiliza el más reciente.",
      "Si el problema continúa, confirma tu asignación con el superadministrador.",
    ],
  },
};

/** Help text, in a native dialog (keyboard accessible, closes with Escape). */
export function HelpDialog({ kind, onClose }: { kind: HelpKind | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (kind && !dialog.open) dialog.showModal();
    if (!kind && dialog.open) dialog.close();
  }, [kind]);

  const content = kind ? CONTENT[kind] : null;
  return (
    <dialog
      ref={ref}
      className="na-help-dialog"
      aria-labelledby="na-help-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
    >
      <button type="button" className="na-theme" aria-label="Cerrar ayuda" onClick={() => ref.current?.close()}>
        ×
      </button>
      <span className="na-eyebrow">TE AYUDAMOS A CONECTAR</span>
      <h2 id="na-help-title">{content?.title}</h2>
      <div>
        {content?.paragraphs.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </div>
      <button type="button" className="na-primary" onClick={() => ref.current?.close()}>
        Entendido <span aria-hidden="true">✓</span>
      </button>
    </dialog>
  );
}
