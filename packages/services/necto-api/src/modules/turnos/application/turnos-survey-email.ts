export interface SurveyEmailInput {
  businessName: string;
  customerName: string | null;
  question: string;
  /** The private link of the survey. */
  link: string;
  validHours: number;
}
const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Every dynamic value that goes into the HTML is escaped, so a business named `<script>` is just text. */
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ESCAPES[character]);
/** A subject is one line: control characters (a newline would start a new header) become spaces. */
const oneLine = (value: string) => value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
/** The invitation to rate the attention, in Spanish, a single column that reads well on a phone. */
export function buildSurveyEmail(input: SurveyEmailInput): { subject: string; text: string; html: string } {
  const business = oneLine(input.businessName);
  const greeting = input.customerName ? `Hola, ${oneLine(input.customerName)}.` : 'Hola.';
  const question = oneLine(input.question);
  const validity = input.validHours >= 48 ? `${Math.round(input.validHours / 24)} días` : `${input.validHours} horas`;
  const subject = business ? `¿Cómo te fue en ${business}?` : '¿Cómo te fue con tu atención?';
  const text = [greeting, '', question, '', `Responde en un minuto: ${input.link}`, '', `El enlace funciona durante ${validity} y solo se puede usar una vez.`].join('\n');
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f5f5f7;font-family:Arial,Helvetica,sans-serif;color:#1d1d1f"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px"><table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;padding:24px"><tr><td><p style="margin:0 0 12px">${escapeHtml(greeting)}</p><p style="margin:0 0 20px;font-size:18px"><strong>${escapeHtml(question)}</strong></p><p style="margin:0 0 20px"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#ff6b00;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px">Calificar la atención</a></p><p style="margin:0;font-size:13px;color:#6e6e73">El enlace funciona durante ${escapeHtml(validity)} y solo se puede usar una vez.${business ? ` Atención de ${escapeHtml(business)}.` : ''}</p></td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}
