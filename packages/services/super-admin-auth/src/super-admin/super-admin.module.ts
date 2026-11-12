import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SuperAdmin, SuperAdminSchema } from './schemas/super-admin.schema';
import { SuperAdminService } from './super-admin.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: SuperAdmin.name, schema: SuperAdminSchema }])],
  providers: [SuperAdminService],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
