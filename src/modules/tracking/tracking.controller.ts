import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Delete,
} from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { CreateTrackingDto, GetTrackingDto, MergeTrackingDto } from './dto/tracking.dto';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Comment out for now

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post()
  async create(@Body() createTrackingDto: CreateTrackingDto) {
    return this.trackingService.create(createTrackingDto);
  }

  @Post('merge')
  async mergeAnonymousTracking(@Body() mergeDto: MergeTrackingDto) {
    return this.trackingService.mergeAnonymousTracking(mergeDto);
  }

  @Get('session/:sessionId')
  async findBySessionId(
    @Param('sessionId') sessionId: string,
    @Query('limit') limit?: string,
  ) {
    return this.trackingService.findBySessionId(sessionId, limit ? parseInt(limit) : 50);
  }

  @Get()
  async findAll(@Query() query: GetTrackingDto) {
    return this.trackingService.findAll(query);
  }

  @Get('user/:userId')
  async findByUserId(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.trackingService.findByUserId(userId, limit ? parseInt(limit) : 50);
  }

  @Get('popular')
  async getPopularProducts(@Query('limit') limit?: string) {
    return this.trackingService.getPopularProducts(limit ? parseInt(limit) : 10);
  }

  @Get('recent/:userId')
  async getRecentlyViewed(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.trackingService.getRecentlyViewed(userId, limit ? parseInt(limit) : 10);
  }

  @Get('stats/hourly')
  async getHourlyStats() {
    return this.trackingService.getHourlyStats();
  }

  @Get('stats/daily')
  async getDailyStats(@Query('days') days?: string) {
    return this.trackingService.getDailyStats(days ? parseInt(days) : 7);
  }

  @Get('stats/user/:userId')
  async getUserBehaviorStats(@Param('userId') userId: string) {
    return this.trackingService.getUserBehaviorStats(userId);
  }

  // Recommendation endpoints
  @Get('recommendations/:userId')
  async getRecommendations(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.trackingService.getRecommendations(userId, limit ? parseInt(limit) : 10);
  }

  @Get('recommendations/collaborative/:userId')
  async getCollaborativeRecommendations(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.trackingService.getCollaborativeRecommendations(userId, limit ? parseInt(limit) : 10);
  }

  @Get('recommendations/content/:userId')
  async getContentBasedRecommendations(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.trackingService.getContentBasedRecommendations(userId, limit ? parseInt(limit) : 10);
  }

  @Get('recommendations/similar/:productId')
  async getSimilarProducts(
    @Param('productId') productId: string,
    @Query('limit') limit?: string,
  ) {
    return this.trackingService.getSimilarProducts(productId, limit ? parseInt(limit) : 10);
  }

  // Protected endpoints (require authentication)
  // @UseGuards(JwtAuthGuard) // Comment out for now
  @Post('track')
  async trackWithAuth(@Request() req, @Body() createTrackingDto: CreateTrackingDto) {
    // Override userId with authenticated user's ID
    const trackingData = {
      ...createTrackingDto,
      userId: req.user?.userId || createTrackingDto.userId,
    };
    return this.trackingService.create(trackingData);
  }

  // @UseGuards(JwtAuthGuard) // Comment out for now
  @Get('my/recommendations')
  async getMyRecommendations(
    @Request() req,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.userId || 'anonymous';
    return this.trackingService.getRecommendations(userId, limit ? parseInt(limit) : 10);
  }

  // @UseGuards(JwtAuthGuard) // Comment out for now
  @Get('my/recent')
  async getMyRecentlyViewed(
    @Request() req,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.userId || 'anonymous';
    return this.trackingService.getRecentlyViewed(userId, limit ? parseInt(limit) : 10);
  }

  // @UseGuards(JwtAuthGuard) // Comment out for now
  @Get('my/stats')
  async getMyStats(@Request() req) {
    const userId = req.user?.userId || 'anonymous';
    return this.trackingService.getUserBehaviorStats(userId);
  }

  // Legacy endpoints for backward compatibility
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trackingService.findOne(+id);
  }

  @Post('update/:id')
  update(@Param('id') id: string, @Body() updateTrackingDto: any) {
    return this.trackingService.update(+id, updateTrackingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.trackingService.remove(+id);
  }
}
