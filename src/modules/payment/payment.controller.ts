import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Req,
  BadRequestException,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentService } from './payment.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { ConfirmCheckoutSessionDto } from './dto/confirm-checkout-session.dto';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';

@Controller('payment')
export class PaymentController {
  private stripe: Stripe;

  constructor(
    private paymentService: PaymentService,
    private configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-12-15.clover',
    });
  }

  @Post('create-checkout-session')
  @UseGuards(JwtAuthGuard)
  async createCheckoutSession(@Body() dto: CreateCheckoutSessionDto, @Request() req: { user?: { id?: string; sub?: string } }) {
    const userId = req.user?.id ?? req.user?.sub;
    return await this.paymentService.createCheckoutSession(dto, userId);
  }

  @Get('checkout-session/:sessionId')
  async getCheckoutSessionOrder(@Param('sessionId') sessionId: string) {
    return await this.paymentService.getOrderByCheckoutSession(sessionId);
  }

  @Post('confirm-checkout-session')
  async confirmCheckoutSession(@Body() dto: ConfirmCheckoutSessionDto) {
    return await this.paymentService.confirmCheckoutSession(dto);
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: ExpressRequest,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecretRaw = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    
    if (!webhookSecretRaw) {
      throw new BadRequestException('Webhook secret is not configured');
    }
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    try {
      const rawBody = req.body;
      if (!rawBody || !(rawBody instanceof Buffer)) {
        throw new BadRequestException('Invalid webhook payload (raw body missing)');
      }

      const secrets = webhookSecretRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      let lastErr: any = null;
      let event: Stripe.Event | null = null;

      for (const secret of secrets) {
        try {
          event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!event) {
        throw lastErr || new Error('Webhook signature verification failed');
      }

      return await this.paymentService.handleWebhook(event);
    } catch (error) {
      throw new BadRequestException(`Webhook Error: ${error.message}`);
    }
  }
}
