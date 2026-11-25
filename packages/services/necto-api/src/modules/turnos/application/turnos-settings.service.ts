import { Injectable } from '@nestjs/common';
import { Clock } from '../../../platform/time/clock';
import type { RoomScreenConfig, SurveyConfig } from '../domain/configuration';
import { AdministratorRequiredError } from '../domain/errors';
import { setRoomScreen, setSurveyConfig } from '../domain/operations';
import type { RoomScreenInput, SurveyInput } from '../domain/settings';
import type { TurnosScope } from './turnos-access.service';
import { TurnosConfigurationStore } from './turnos-configuration.store';
import { TurnosRealtimeHub } from './turnos-realtime.hub';
/**
 * The room screen and survey settings. They are tools of the running business, not steps of its first configuration: saving them does not
 * clear "ready" and only the administrator can change them.
 */
@Injectable()
export class TurnosSettingsService {
  constructor(
    private readonly store: TurnosConfigurationStore,
    private readonly hub: TurnosRealtimeHub,
    private readonly clock: Clock,
  ) {}
  async saveRoomScreen(scope: TurnosScope, input: RoomScreenInput): Promise<RoomScreenConfig> {
    if (scope.role !== 'admin') throw new AdministratorRequiredError();
    const saved = await this.store.update(scope.businessId, (config, now) => setRoomScreen(config, input, now));
    this.hub.publish({ type: 'room-screen.updated', businessId: scope.businessId, at: this.clock.now(), queueId: null });
    return saved.roomScreen;
  }
  async saveSurvey(scope: TurnosScope, input: SurveyInput): Promise<SurveyConfig> {
    if (scope.role !== 'admin') throw new AdministratorRequiredError();
    const saved = await this.store.update(scope.businessId, (config, now) => setSurveyConfig(config, input, now));
    this.hub.publish({ type: 'config.updated', businessId: scope.businessId, at: this.clock.now(), queueId: null });
    return saved.survey;
  }
}
