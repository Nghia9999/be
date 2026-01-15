import { Controller, Get, Param, Query } from '@nestjs/common';
import { TrackingService } from '../tracking/tracking.service';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get(':userId')
  async getRecommendations(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? parseInt(limit) : 10;
    return this.trackingService.getRecommendations(userId, n);
  }

  @Get('collaborative/:userId')
  async getCollaborativeRecommendations(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? parseInt(limit) : 10;
    return this.trackingService.getCollaborativeRecommendations(userId, n);
  }

  @Get('content/:userId')
  async getContentBasedRecommendations(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? parseInt(limit) : 10;
    return this.trackingService.getContentBasedRecommendations(userId, n);
  }

  @Get('similar/:productId')
  async getSimilarProducts(
    @Param('productId') productId: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? parseInt(limit) : 10;
    return this.trackingService.getSimilarProducts(productId, n);
  }
}
