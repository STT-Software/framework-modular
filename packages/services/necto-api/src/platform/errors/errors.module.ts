import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DomainErrorFilter } from './domain-error.filter';

@Module({
  providers: [{ provide: APP_FILTER, useClass: DomainErrorFilter }],
})
export class ErrorsModule {}
