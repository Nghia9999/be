import { Module } from '@nestjs/common';
import { TrackingModule } from '../tracking/tracking.module';
import { RecommendationsController } from './recommendations.controller';

@Module({
  imports: [TrackingModule],
  controllers: [RecommendationsController],
})
export class RecommendationsModule {}
