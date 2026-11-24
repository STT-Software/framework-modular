import { Controller, Get, Req, UseInterceptors } from '@nestjs/common';
import { NoStoreInterceptor } from '../../../platform/http/no-store.interceptor';
import { AdministersBusiness, type AdminRequest } from '../../business-access/public';
import { BusinessDashboardService } from '../application/business-dashboard.service';
import { toDashboardResponse } from './business-dashboard.response';
/**
 * The general dashboard of a business, for its ADMINISTRATOR. Guarded by `@AdministersBusiness()`: on every request the signed-in person must
 * be the current boss of that active business (an operator is never let in: operators go straight to their module). `entry` says where the
 * administrator goes: `dashboard` when everything is prepared, `setup` (with `setup.next`) while something is missing.
 */
@Controller('dashboard/businesses/:businessId')
@AdministersBusiness()
@UseInterceptors(NoStoreInterceptor)
export class BusinessDashboardController {
  constructor(private readonly dashboard: BusinessDashboardService) {}
  @Get()
  async get(@Req() request: AdminRequest) {
    return toDashboardResponse(await this.dashboard.get(request.adminSession!.email, request.params.businessId));
  }
}
