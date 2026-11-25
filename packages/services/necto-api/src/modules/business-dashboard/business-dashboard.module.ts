import { Module } from '@nestjs/common';
import { SecurityModule } from '../../platform/security/security.module';
import { TimeModule } from '../../platform/time/time.module';
import { BusinessAccessModule } from '../business-access/public';
import { BusinessSetupModule } from '../business-setup/public';
import { TurnosModule } from '../turnos/public';
import { BusinessDashboardController } from './api/business-dashboard.controller';
import { BusinessDashboardService } from './application/business-dashboard.service';
/**
 * The general dashboard of a business: which modules it has and how far each one is, plus the real indicators of the modules that already
 * run. It owns no data: it reads the setup through the public door of `business-setup` and the indicators through the one of each module.
 */
@Module({
  imports: [SecurityModule, TimeModule, BusinessAccessModule, BusinessSetupModule, TurnosModule],
  controllers: [BusinessDashboardController],
  providers: [BusinessDashboardService],
})
export class BusinessDashboardModule {}
