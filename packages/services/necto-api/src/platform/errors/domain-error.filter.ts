import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError, type DomainErrorKind } from './domain-error';

const HTTP_BY_KIND: Record<DomainErrorKind, { status: HttpStatus; label: string }> = {
  conflict: { status: HttpStatus.CONFLICT, label: 'Conflict' },
  unauthenticated: { status: HttpStatus.UNAUTHORIZED, label: 'Unauthorized' },
  forbidden: { status: HttpStatus.FORBIDDEN, label: 'Forbidden' },
  'not-found': { status: HttpStatus.NOT_FOUND, label: 'Not Found' },
  'rate-limited': { status: HttpStatus.TOO_MANY_REQUESTS, label: 'Too Many Requests' },
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
    response.status(status).json({ message: error.message, error: label, statusCode: status });
  }
}
