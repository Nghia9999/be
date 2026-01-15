import { Prop, Schema } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class UserTracking {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  user?: Types.ObjectId;

  @Prop({ required: true, index: true })
  deviceId: string;

  @Prop({ required: true, index: true })
  sessionId: string;

  @Prop({ required: true, index: true })
  action: string;
  // view_product | add_to_cart | purchase

  @Prop({ type: Types.ObjectId, index: true })
  product?: Types.ObjectId;

  @Prop({ default: 1 })
  count: number;
}
