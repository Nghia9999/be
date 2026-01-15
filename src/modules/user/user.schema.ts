import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: true })
  password: string;
 

  @Prop({ default: 'user', index: true })
  role: 'user' | 'admin';

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  avatar?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
