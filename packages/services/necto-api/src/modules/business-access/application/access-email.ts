import type { ChallengePurpose } from '../domain/challenge';

export interface AccessEmailInput {
  purpose: ChallengePurpose;
  /** Who the email greets. */
  recipientName: string;
  /** Invitations only: the business the person was assigned to. */
  businessName: string | null;
  code: string;
  ttlMinutes: number;
  /** Link to the access page. It never contains the code. */
  accessUrl: string;
}

export interface AccessEmail {
  subject: string;
  text: string;
  html: string;
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Every dynamic value that goes into the HTML is escaped, so a business named `<script>` is just text. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

/** A subject is one line: control characters (a newline would start a new header) become spaces. */
function oneLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
}

/**
 * The email with the access code, in Spanish. It is sign-in by email without a password; it is not described
 * as multi-factor authentication. Layout is a single column that reads well on a phone.
 */
export function buildAccessEmail(input: AccessEmailInput): AccessEmail {
  const name = oneLine(input.recipientName);
  const business = input.businessName ? oneLine(input.businessName) : null;
  const subject =
    input.purpose === 'invitation' && business
      ? `Te asignaron como jefe de ${business} en Necto`
      : input.purpose === 'reverify'
        ? 'Tu código para confirmar tu identidad en Necto'
        : 'Tu código para entrar a Necto';
  const intro =
    input.purpose === 'invitation' && business
      ? `Hola ${name}, te asignaron como jefe de "${business}" en Necto.`
      : input.purpose === 'reverify'
        ? `Hola ${name}, este es el código para confirmar tu identidad en Necto.`
        : `Hola ${name}, este es tu código para entrar a tu negocio en Necto.`;
  const validity = `El código es válido por ${input.ttlMinutes} minutos y solo puede usarse una vez.`;
  const ignore = 'Si no esperabas este correo, puedes ignorarlo: nadie podrá entrar sin el código.';

  const text = [
    intro,
    '',
    `Tu código: ${input.code}`,
    validity,
    '',
    `Entra aquí, escribe tu correo e introduce el código: ${input.accessUrl}`,
    '',
    ignore,
    '',
    'Necto · Conecta. Comparte. Crece.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f6f5fb;font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#101828;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5fb;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e4e7ec;">
        <tr><td style="padding:28px 28px 8px;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#ff3f1a;">necto <span style="font-size:12px;font-weight:500;color:#190088;">grow together</span></td></tr>
        <tr><td style="padding:8px 28px 0;font-size:15px;line-height:1.6;">${escapeHtml(intro)}</td></tr>
        <tr><td align="center" style="padding:20px 28px 4px;">
          <div style="display:inline-block;padding:14px 22px;border-radius:12px;background:#fff5f1;border:1px solid #ffd7cd;font-size:32px;font-weight:700;letter-spacing:8px;color:#190088;">${escapeHtml(input.code)}</div>
        </td></tr>
        <tr><td style="padding:8px 28px 0;font-size:13px;line-height:1.6;color:#667085;text-align:center;">${escapeHtml(validity)}</td></tr>
        <tr><td align="center" style="padding:20px 28px 0;">
          <a href="${escapeHtml(input.accessUrl)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#190088;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Ir al acceso de Necto</a>
        </td></tr>
        <tr><td style="padding:20px 28px 0;font-size:12px;line-height:1.6;color:#667085;">${escapeHtml(ignore)}</td></tr>
        <tr><td style="padding:20px 28px 24px;font-size:11px;color:#98a2b3;">Necto · Conecta. Comparte. Crece.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
