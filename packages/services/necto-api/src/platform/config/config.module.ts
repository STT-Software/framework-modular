import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation';

/** The only place where the environment is read and validated. Global: `ConfigService` is available everywhere. */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })],
})
export class PlatformConfigModule {}
