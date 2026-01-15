import { IsInt, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateRatingDto {
  @IsMongoId()
  productId: string;

  @IsMongoId()
  userId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  value: number;

  @IsString()
  @IsOptional()
  comment?: string;
}
