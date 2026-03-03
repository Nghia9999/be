import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentService } from './payment.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

@Controller('payment')
export class PaymentController implements OnModuleInit {
  private stripe: Stripe;

  constructor(
    private paymentService: PaymentService,
    private configService: ConfigService,
  ) {}

  onModuleInit() {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-12-15.clover',
      });
    }
  }

  @Post('create-payment-intent')
  async createPaymentIntent(@Body() dto: CreatePaymentIntentDto) {
    return await this.paymentService.createPaymentIntent(dto);
  }

  @Post('confirm-payment')
  async confirmPayment(@Body() dto: ConfirmPaymentDto) {
    return await this.paymentService.confirmPayment(dto);
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret is not configured');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        (req as any).rawBody,
        signature,
        webhookSecret,
      );

      return await this.paymentService.handleWebhook(event);
    } catch (error) {
      throw new BadRequestException(`Webhook Error: ${error.message}`);
    }
  }
}
