import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/**
 * Turns the validation errors of a request into a 400 that a form can use: `message` keeps the flat list of
 * sentences (what every client already reads) and `fields` says which field each one belongs to, with nested
 * fields as dotted paths (for example `boss.email`).
 */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const fields: Record<string, string[]> = {};
  const messages: string[] = [];

  const walk = (error: ValidationError, parent: string): void => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) {
      const sentences = Object.values(error.constraints);
      fields[path] = sentences;
      messages.push(...sentences);
    }
    error.children?.forEach((child) => walk(child, path));
  };
  errors.forEach((error) => walk(error, ''));

  return new BadRequestException({ statusCode: 400, error: 'Bad Request', message: messages, fields });
}
