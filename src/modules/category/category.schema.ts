import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true })
  name: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
  })
  parent: mongoose.Types.ObjectId | null;
  @Prop({ required: true, default: 0 })
  level: number;

  // chặn gán product vào category cha
  @Prop({ default: true })
  isLeaf: boolean;

  // bật / tắt hiển thị
  @Prop({ default: true })
  isActive: boolean;
  @Prop()
  slug: string;

  @Prop()
  description: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
