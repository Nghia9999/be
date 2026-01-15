import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { RatingService } from './rating.service';
import { CreateRatingDto } from './dto/create-rating.dto';

@Controller('rating')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Post()
  upsert(@Body() createRatingDto: CreateRatingDto) {
    return this.ratingService.upsert(createRatingDto);
  }

  @Get('product/:productId')
  findByProduct(@Param('productId') productId: string) {
    return this.ratingService.findByProduct(productId);
  }

  @Get('summary/:productId')
  getSummary(@Param('productId') productId: string) {
    return this.ratingService.getSummary(productId);
  }
}
