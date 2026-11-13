import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError, type DomainErrorKind } from './domain-error';

const HTTP_BY_KIND: Record<DomainErrorKind, { status: HttpStatus; label: string }> = {
  conflict: { status: HttpStatus.CONFLICT, label: 'Conflict' },
  unauthenticated: { status: HttpStatus.UNAUTHORIZED, label: 'Unauthorized' },
  'not-found': { status: HttpStatus.NOT_FOUND, label: 'Not Found' },
};

/** Same body shape as Nest's own HTTP exceptions: { message, error, statusCode }. */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const { status, label } = HTTP_BY_KIND[error.kind];
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ message: error.message, error: label, statusCode: status });
  }
}
