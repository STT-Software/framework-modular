import { LIMITS } from './catalog';
import type { Operator, Queue } from './configuration';
import { TurnosInvalidError } from './errors';
import { Issues } from './issues';

export interface OperatorInput {
  name: string;
  email: string;
  phone?: string | null;
  queueIds: string[];
}

export type ParsedOperator = Omit<Operator, 'id' | 'createdAt'>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = new RegExp(`^\\+?[0-9]{${LIMITS.phoneDigits.min},${LIMITS.phoneDigits.max}}$`);

/**
 * Validates an operator: name and email are required (the email is how they sign in, so it is unique among the operators of
 * the business, and it must arrive already normalized with the platform rule: trimmed and lowercase, which the application does),
 * the phone is optional, and they need at least one queue, all of them queues of THIS business.
 *
 * @throws TurnosInvalidError (`invalid-operator`) with every problem found.
 */
export function parseOperator(input: OperatorInput, context: { queues: readonly Queue[]; others: readonly Operator[] }): ParsedOperator {
  const issues = new Issues();
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < LIMITS.operatorName.min || name.length > LIMITS.operatorName.max) {
    issues.add('name', `name must be ${LIMITS.operatorName.min} to ${LIMITS.operatorName.max} characters long`);
  }
  const email = typeof input.email === 'string' ? input.email : '';
  if (!EMAIL.test(email) || email !== email.toLowerCase() || email.length > LIMITS.operatorEmail.max) {
    issues.add('email', 'email is required and must be a valid email address: it is how the operator signs in');
  } else if (context.others.some((other) => other.email === email)) {
    issues.add('email', 'This email already belongs to an operator of Turnos in this business');
  }
  let phone: string | null = null;
  if (typeof input.phone === 'string' && input.phone.trim() !== '') {
    phone = input.phone.replace(/[\s().-]/g, '');
    if (!PHONE.test(phone)) {
      issues.add('phone', `phone must have ${LIMITS.phoneDigits.min} to ${LIMITS.phoneDigits.max} digits, with an optional leading +`);
      phone = null;
    }
  }
  const queueIds = Array.isArray(input.queueIds) ? [...new Set(input.queueIds.filter((id): id is string => typeof id === 'string'))] : [];
  if (queueIds.length === 0) {
    issues.add('queueIds', 'An operator needs at least one queue');
  } else if (queueIds.some((id) => !context.queues.some((queue) => queue.id === id))) {
    issues.add('queueIds', 'Every queue of an operator must be an existing queue of this business');
  }
  if (issues.any) throw new TurnosInvalidError('invalid-operator', issues.fields);
  return { name, email, phone, queueIds };
}
