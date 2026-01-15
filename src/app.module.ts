import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { CartModule } from './modules/cart/cart.module';
import { CategoryModule } from './modules/category/category.module';
import { UserModule } from './modules/user/user.module';
import { OrderModule } from './modules/order/order.module';
import { RatingModule } from './modules/rating/rating.module';
import { ProductModule } from './modules/product/product.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryModule } from './common/cloudinary/cloudinary.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI') || process.env.MONGODB_URI,
        // you can add mongoose options here if needed
      }),
    }),
    CloudinaryModule,
    AuthModule,
    CartModule,
    CategoryModule,
    UserModule,
    OrderModule,
    RatingModule,
    ProductModule,
    TrackingModule,
    RecommendationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
