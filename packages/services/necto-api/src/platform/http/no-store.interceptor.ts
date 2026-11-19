import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';

/** What is answered here is private to one administrator: no browser or proxy cache may keep it. */
@Injectable()
export class NoStoreInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'no-store');
    return next.handle();
  }
}
