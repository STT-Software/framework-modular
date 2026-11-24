import { LIMITS, OPERATOR_STATUSES, OPERATOR_VIEWS, type OperatorStatus, type OperatorViewId } from './catalog';
import type { Operator, Queue } from './configuration';
import { isEmail, normalizePhone } from './contact';
import { TurnosInvalidError } from './errors';
import { Issues } from './issues';

export interface OperatorInput {
  name: string;
  email: string;
  phone?: string | null;
  queueIds: string[];
  /** The views of the workspace this operator may use. Left out: they keep theirs (all of them for a new operator). */
  views?: string[] | null;
  /** `active` or `inactive` (and `pending` for a new operator). Left out: they keep theirs (`pending` for a new operator). */
  status?: string | null;
}
export type ParsedOperator = Pick<Operator, 'name' | 'email' | 'phone' | 'queueIds' | 'views' | 'status'>;
/**
 * Validates an operator: name and email are required (the email is how they sign in, so it is unique among the operators of
 * the business, and it must arrive already normalized with the platform rule: trimmed and lowercase, which the application does),
 * the phone is optional, and they need at least one queue, all of them queues of THIS business.
 *
 * @throws TurnosInvalidError (`invalid-operator`) with every problem found.
 */
export function parseOperator(input: OperatorInput, context: { queues: readonly Queue[]; others: readonly Operator[]; current?: Operator }): ParsedOperator {
  const issues = new Issues();
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < LIMITS.operatorName.min || name.length > LIMITS.operatorName.max) {
    issues.add('name', `name must be ${LIMITS.operatorName.min} to ${LIMITS.operatorName.max} characters long`);
  }
  const email = typeof input.email === 'string' ? input.email : '';
  if (!isEmail(email) || email !== email.toLowerCase() || email.length > LIMITS.operatorEmail.max) {
    issues.add('email', 'email is required and must be a valid email address: it is how the operator signs in');
  } else if (context.others.some((other) => other.email === email)) {
    issues.add('email', 'This email already belongs to an operator of Turnos in this business');
  }
  let phone: string | null = null;
  if (typeof input.phone === 'string' && input.phone.trim() !== '') {
    phone = normalizePhone(input.phone);
    if (phone === null) {
      issues.add('phone', `phone must have ${LIMITS.phoneDigits.min} to ${LIMITS.phoneDigits.max} digits, with an optional leading +`);
    }
  }
  const queueIds = Array.isArray(input.queueIds) ? [...new Set(input.queueIds.filter((id): id is string => typeof id === 'string'))] : [];
  if (queueIds.length === 0) {
    issues.add('queueIds', 'An operator needs at least one queue');
  } else if (queueIds.some((id) => !context.queues.some((queue) => queue.id === id))) {
    issues.add('queueIds', 'Every queue of an operator must be an existing queue of this business');
  }
  let views: OperatorViewId[] = context.current ? [...context.current.views] : [...OPERATOR_VIEWS];
  if (input.views !== undefined && input.views !== null) {
    const asked = Array.isArray(input.views) ? input.views : null;
    if (!asked || asked.some((view) => !OPERATOR_VIEWS.some((known) => known === view))) {
      issues.add('views', `views must be a list of: ${OPERATOR_VIEWS.join(', ')}`);
    } else {
      // Always in the order the workspace offers them, whatever order they were sent in, so the first one is predictable.
      views = OPERATOR_VIEWS.filter((view) => asked.includes(view));
    }
  }
  let status: OperatorStatus = context.current?.status ?? 'pending';
  if (input.status !== undefined && input.status !== null) {
    const asked = OPERATOR_STATUSES.find((candidate) => candidate === input.status);
    if (!asked) issues.add('status', `status must be one of: ${OPERATOR_STATUSES.join(', ')}`);
    else if (asked === 'pending' && status !== 'pending') issues.add('status', 'An operator who already signed in cannot go back to pending: use active or inactive');
    else status = asked;
  }
  if (issues.any) throw new TurnosInvalidError('invalid-operator', issues.fields);
  return { name, email, phone, queueIds, views, status };
}
