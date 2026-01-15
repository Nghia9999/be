import { IsString, IsEnum, IsOptional, IsObject, IsNotEmpty } from 'class-validator';
import { TrackingAction } from '../schemas/tracking.schema';

export class CreateTrackingDto {
  @IsString()
  @IsNotEmpty()
  userId: string; // Can be 'anonymous' or actual user ID

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;

  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsEnum(TrackingAction)
  action: TrackingAction;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class GetTrackingDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsEnum(TrackingAction)
  @IsOptional()
  action?: TrackingAction;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}

export class MergeTrackingDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}
