import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AdministersBusiness, type AdminRequest } from '../../business-access/public';
import { BusinessCategoryDto } from '../../businesses/public';
import { BusinessSetupService } from '../application/business-setup.service';
import { LOGO_MAX_BYTES } from '../domain/logo';
import { NoStoreInterceptor } from './no-store.interceptor';
import { toModulesResponse, toSetupResponse } from './business-setup.response';
import { SaveModuleScheduleDto, SaveProfileDto, SaveProgressDto, SaveScheduleDto } from './dto/setup.dto';

/** What multer gives for an uploaded file (kept in memory; the 1 MB limit keeps that small). */
interface UploadedLogo {
  buffer: Buffer;
  mimetype: string;
}

/**
 * The initial configuration of a business, for its administrator. EVERY route is under `:businessId` and is guarded by
 * `@AdministersBusiness()`: the signed-in person must be the current boss of that active business, checked against the
 * database on each request. Another business, a paused one and an unknown one all answer 404; a super admin's token, 403.
 * The administrator is always taken from the session, never from the body or the URL.
 */
@Controller('business-setup/businesses/:businessId')
@AdministersBusiness()
@UseInterceptors(NoStoreInterceptor)
export class BusinessSetupController {
  constructor(private readonly setup: BusinessSetupService) {}

  /** The whole setup, to open it again where the person left it. */
  @Get()
  async get(@Req() request: AdminRequest, @Param('businessId') businessId: string) {
    return toSetupResponse(await this.setup.get(email(request), businessId));
  }

  /** Only the modules the owner enabled for this business, and whether the base is ready. */
  @Get('modules')
  async modules(@Req() request: AdminRequest, @Param('businessId') businessId: string) {
    return toModulesResponse(await this.setup.get(email(request), businessId));
  }

  /** Saves the form "Datos del negocio" (it replaces the contact data and the description). */
  @Put('profile')
  async saveProfile(@Req() request: AdminRequest, @Param('businessId') businessId: string, @Body() dto: SaveProfileDto) {
    const { description, ...contact } = dto;
    const contactChange = {
      name: contact.name,
      legalName: contact.legalName ?? null,
      taxId: contact.taxId ?? null,
      phone: contact.phone ?? null,
      address: contact.address ?? null,
      supportEmail: contact.supportEmail ?? null,
      website: contact.website ?? null,
    };
    return toSetupResponse(await this.setup.saveProfile(email(request), businessId, { contact: contactChange, description: description ?? null }));
  }

  /** The type of business. "other" requires `categoryOther`. */
  @Put('category')
  async saveCategory(@Req() request: AdminRequest, @Param('businessId') businessId: string, @Body() dto: BusinessCategoryDto) {
    return toSetupResponse(await this.setup.saveCategory(email(request), businessId, dto.category, dto.categoryOther ?? null));
  }

  /** The logo as an image (PNG, JPG or WebP). */
  @Get('logo')
  @Header('X-Content-Type-Options', 'nosniff')
  async logo(@Req() request: AdminRequest, @Param('businessId') businessId: string, @Res({ passthrough: true }) response: Response) {
    const logo = await this.setup.getLogo(email(request), businessId);
    response.setHeader('Content-Type', logo.info.contentType);
    response.setHeader('Content-Length', String(logo.info.sizeBytes));
    return new StreamableFile(logo.bytes);
  }

  /** Uploads or replaces the logo: `multipart/form-data` with the field `logo`. PNG, JPG or WebP, at most 1 MB. */
  @Put('logo')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: LOGO_MAX_BYTES, files: 1, fields: 0 } }))
  async uploadLogo(@Req() request: AdminRequest, @Param('businessId') businessId: string, @UploadedFile() file: UploadedLogo | undefined) {
    return toSetupResponse(
      await this.setup.uploadLogo(email(request), businessId, { bytes: file?.buffer ?? new Uint8Array(), declaredType: file?.mimetype }),
    );
  }

  @Delete('logo')
  async removeLogo(@Req() request: AdminRequest, @Param('businessId') businessId: string) {
    return toSetupResponse(await this.setup.removeLogo(email(request), businessId));
  }

  /** The opening hours of the business. Modules that inherit them show the new hours at once; the ones with their own keep them. */
  @Put('schedule')
  async saveSchedule(@Req() request: AdminRequest, @Param('businessId') businessId: string, @Body() dto: SaveScheduleDto) {
    return toSetupResponse(await this.setup.saveBaseSchedule(email(request), businessId, dto.schedule));
  }

  /** How an assigned module gets its hours: inheriting the business's, or its own. 403 `module-not-enabled` if it is not assigned. */
  @Put('schedule/modules/:moduleId')
  async saveModuleSchedule(
    @Req() request: AdminRequest,
    @Param('businessId') businessId: string,
    @Param('moduleId') moduleId: string,
    @Body() dto: SaveModuleScheduleDto,
  ) {
    return toSetupResponse(await this.setup.saveModuleSchedule(email(request), businessId, moduleId, { inherit: dto.inherit, schedule: dto.schedule }));
  }

  /** Remembers the step the person is on, to continue from there later. */
  @Put('progress')
  async saveProgress(@Req() request: AdminRequest, @Param('businessId') businessId: string, @Body() dto: SaveProgressDto) {
    return toSetupResponse(await this.setup.saveProgress(email(request), businessId, dto.step));
  }

  /** "Guardar configuración base": marks only the base as ready. The settings of each module stay pending. */
  @Post('complete')
  @HttpCode(200)
  async complete(@Req() request: AdminRequest, @Param('businessId') businessId: string) {
    return toSetupResponse(await this.setup.complete(email(request), businessId));
  }
}

/** The administrator, from the session the guard already checked. */
function email(request: AdminRequest): string {
  return request.adminSession!.email;
}
