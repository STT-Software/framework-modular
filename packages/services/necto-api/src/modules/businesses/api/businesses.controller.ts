import { BadRequestException, Body, Controller, Get, Header, Headers, HttpCode, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../../../platform/security/authenticated-user';
import { CurrentUser } from '../../../platform/security/current-user.decorator';
import { SuperAdminOnly } from '../../../platform/security/super-admin-only.decorator';
import { BusinessService } from '../application/business.service';
import { BUSINESS_CATEGORIES, BUSINESS_MODULES } from '../domain/catalog';
import { toBusinessResponse } from './business.response';
import { BusinessDto, toBusinessDraft } from './dto/business.dto';
import { BusinessFiltersDto, ListBusinessesDto } from './dto/list-businesses.dto';

const DEFAULT_PAGE_SIZE = 12;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * The businesses of the authenticated super admin. The owner always comes from the session: there is no way
 * to send an owner, and a business that belongs to someone else answers 404 as if it did not exist.
 */
@Controller('businesses')
@SuperAdminOnly()
export class BusinessesController {
  constructor(private readonly businesses: BusinessService) {}

  /** The functionalities and categories a business can be given. */
  @Get('catalog')
  catalog() {
    return { modules: BUSINESS_MODULES, categories: BUSINESS_CATEGORIES };
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="negocios.csv"')
  @Header('Cache-Control', 'no-store')
  exportCsv(@CurrentUser() user: AuthenticatedUser, @Query() filters: BusinessFiltersDto) {
    return this.businesses.exportCsv(user.userId, filters);
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListBusinessesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const { items, total } = await this.businesses.list(user.userId, { ...query, page, pageSize });
    return { items: items.map(toBusinessResponse), total, page, pageSize };
  }

  /**
   * Creates a business with its boss. The `Idempotency-Key` header makes it safe to repeat: the same key
   * returns the same business (200) instead of creating another (201).
   */
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BusinessDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!key || !IDEMPOTENCY_KEY.test(key)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: ['Idempotency-Key header is required: 8 to 64 characters (letters, digits, hyphen or underscore)'],
        fields: { 'Idempotency-Key': ['required'] },
      });
    }
    const { business, created } = await this.businesses.create(user.userId, toBusinessDraft(dto), key);
    response.status(created ? 201 : 200);
    return toBusinessResponse(business);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return toBusinessResponse(await this.businesses.get(user.userId, id));
  }

  /** Replaces the editable data of the business (profile, modules and boss), keeping its id. */
  @Put(':id')
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: BusinessDto) {
    return toBusinessResponse(await this.businesses.update(user.userId, id, toBusinessDraft(dto)));
  }

  @Post(':id/pause')
  @HttpCode(200)
  async pause(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return toBusinessResponse(await this.businesses.pause(user.userId, id));
  }

  @Post(':id/resume')
  @HttpCode(200)
  async resume(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return toBusinessResponse(await this.businesses.resume(user.userId, id));
  }
}
