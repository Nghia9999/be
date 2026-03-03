import { IsString, IsObject, IsOptional } from 'class-validator';

export class CustomerInfoDto {
  @IsString()
  name: string;

  @IsString()
  email: string;

  @IsString()
  phone: string;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class ConfirmPaymentDto {
  @IsString()
  paymentIntentId: string;

  @IsObject()
  customerInfo: CustomerInfoDto;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
