import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError, type DomainErrorKind } from './domain-error';

const HTTP_BY_KIND: Record<DomainErrorKind, { status: HttpStatus; label: string }> = {
  conflict: { status: HttpStatus.CONFLICT, label: 'Conflict' },
  unauthenticated: { status: HttpStatus.UNAUTHORIZED, label: 'Unauthorized' },
  forbidden: { status: HttpStatus.FORBIDDEN, label: 'Forbidden' },
  'not-found': { status: HttpStatus.NOT_FOUND, label: 'Not Found' },
  'rate-limited': { status: HttpStatus.TOO_MANY_REQUESTS, label: 'Too Many Requests' },
  invalid: { status: HttpStatus.BAD_REQUEST, label: 'Bad Request' },
};

/** Same body shape as Nest's own HTTP exceptions: { message, error, statusCode }. */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const { status, label } = HTTP_BY_KIND[error.kind];
    const response = host.switchToHttp().getResponse<Response>();
    if (error.kind === 'rate-limited' && error.retryAfterSeconds !== undefined) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil(error.retryAfterSeconds))));
    }
    // An `invalid` error keeps the shape of a DTO validation error: `message` is the list of sentences and `fields` says where.
    const message = error.kind === 'invalid' && error.fields ? Object.values(error.fields).flat() : error.message;
    response.status(status).json({
      message,
      error: label,
      statusCode: status,
      ...(error.code ? { code: error.code } : {}),
      ...(error.fields ? { fields: error.fields } : {}),
    });
  }
}
