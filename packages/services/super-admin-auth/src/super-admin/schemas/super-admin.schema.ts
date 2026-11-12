import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * SuperAdmin: the account that manages the whole platform. It is independent from
 * a business admin (which will have its own login and its own collection).
 *
 * The unique indexes make MongoDB reject duplicates even when two registrations
 * arrive at the same time (it does not rely on a previous query).
 */
@Schema({ timestamps: true, collection: 'super_admins' })
export class SuperAdmin {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  username: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  /** bcrypt hash of the password. The password is never stored or returned in plain text. */
  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, unique: true, trim: true })
  identityDocument: string;
}

export type SuperAdminDocument = HydratedDocument<SuperAdmin>;
export const SuperAdminSchema = SchemaFactory.createForClass(SuperAdmin);
