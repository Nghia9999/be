import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum TrackingAction {
  VIEW = 'view',
  CLICK = 'click',
  ADD_TO_CART = 'add_to_cart',
  PURCHASE = 'purchase',
  SEARCH = 'search',
}

@Schema({ timestamps: true })
export class Tracking extends Document {
  @Prop({ required: true, index: true })
  userId: string; // Can be 'anonymous' or actual user ID

  @Prop({ required: false, index: true })
  sessionId?: string; // For anonymous users

  @Prop({ required: false, index: true })
  ipAddress?: string; // For anonymous users

  @Prop({ required: false, index: true })
  userAgent?: string; // Browser/device info

  @Prop({ required: true, index: true })
  productId: string;

  @Prop({ required: false, index: true })
  categoryId?: string;

  @Prop({ required: true, enum: TrackingAction })
  action: TrackingAction;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export type TrackingDocument = Tracking & Document;

export const TrackingSchema = SchemaFactory.createForClass(Tracking);

// Indexes for performance
TrackingSchema.index({ userId: 1, timestamp: -1 });
TrackingSchema.index({ sessionId: 1, timestamp: -1 });
TrackingSchema.index({ productId: 1, action: 1 });
TrackingSchema.index({ categoryId: 1, action: 1 });
TrackingSchema.index({ timestamp: -1 });
