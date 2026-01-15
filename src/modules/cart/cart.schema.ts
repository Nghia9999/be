import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CartDocument = Cart & Document;

@Schema({
  timestamps: true,
  collection: 'carts',
})
export class Cart {
  @Prop({ required: false, index: true })
  sessionId?: string; // For anonymous users

  @Prop({ required: false, index: true })
  userId?: string; // For logged-in users

  @Prop({ required: true, index: true })
  productId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  image: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: false })
  size?: string;

  @Prop({ required: false })
  color?: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export const CartSchema = SchemaFactory.createForClass(Cart);
