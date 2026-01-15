import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'ratings' })
export class Rating {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  value: number;

  @Prop()
  comment?: string;
}

export type RatingDocument = Rating & Document;

export const RatingSchema = SchemaFactory.createForClass(Rating);

RatingSchema.index({ productId: 1, userId: 1 }, { unique: true });
