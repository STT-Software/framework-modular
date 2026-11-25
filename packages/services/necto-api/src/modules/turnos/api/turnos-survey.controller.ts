import { Body, Controller, Get, HttpCode, Param, Post, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NoStoreInterceptor } from '../../../platform/http/no-store.interceptor';
import { TurnosSurveyService } from '../application/turnos-survey.service';
import { SurveyAnswerDto } from './dto/operation.dto';
/**
 * What the CUSTOMER uses: the private link of their survey. There is no sign-in: the link itself (a long random token that is only stored
 * as a hash) is the credential, it works once, and it expires. An unknown link answers 404 whatever is wrong with it.
 */
@Controller('turnos/surveys/:token')
@UseInterceptors(NoStoreInterceptor)
export class TurnosSurveyController {
  constructor(private readonly surveys: TurnosSurveyService) {}
  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async open(@Param('token') token: string) {
    const survey = await this.surveys.open(token);
    return { ...survey, expiresAt: survey.expiresAt.toISOString() };
  }
  /** Saves the rating (1 to 5) and the comment. 409 `survey-closed` when it was already answered or the link expired. */
  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async respond(@Param('token') token: string, @Body() dto: SurveyAnswerDto) {
    return { answered: true, ...(await this.surveys.respond(token, dto)) };
  }
}
