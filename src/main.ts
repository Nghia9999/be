import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    
    // Middleware for Stripe webhook (must be before other body parsers)
    app.use('/api/payment/webhook', bodyParser.raw({ type: 'application/json' }));
    
    app.use(cookieParser());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.enableCors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'stripe-signature'],
    });

    const rawPort = process.env.PORT;
    const port = rawPort ? parseInt(rawPort.toString().replace(/[^0-9]/g, ''), 10) : 4000;
    if (isNaN(port)) {
      console.warn(`⚠️ Invalid PORT value '${rawPort}', falling back to 4000`);
    }
    const listenPort = isNaN(port) ? 4000 : port;

    await app.listen(listenPort);
    console.log(`✅ Application is running on port ${listenPort}`);
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

bootstrap();

