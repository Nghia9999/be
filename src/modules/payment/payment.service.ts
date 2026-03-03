import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CartService } from '../cart/cart.service';
import { OrderService } from '../order/order.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateOrderDto } from '../order/dto/create-order.dto';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private cartService: CartService,
    private orderService: OrderService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-12-15.clover',
    });
  }

  async createPaymentIntent(dto: CreatePaymentIntentDto) {
    try {
      if (dto.amount <= 0) {
        throw new BadRequestException('Amount must be greater than 0');
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(dto.amount * 100), // Convert to cents
        currency: dto.currency || 'vnd',
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        metadata: {
          userId: dto.userId || 'guest',
          sessionId: dto.sessionId || '',
          itemCount: dto.items.length.toString(),
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: dto.amount,
        currency: dto.currency || 'vnd',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Failed to create payment intent: ${error.message}`);
    }
  }

  async confirmPayment(dto: ConfirmPaymentDto) {
    try {
      // Retrieve the payment intent from Stripe
      const paymentIntent = await this.stripe.paymentIntents.retrieve(dto.paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        throw new BadRequestException(
          `Payment failed with status: ${paymentIntent.status}`,
        );
      }

      // Create order in database
      const orderData: CreateOrderDto = {
        userId: dto.userId ?? undefined,
        items: [], // Will be from metadata or separate request
        customerInfo: dto.customerInfo,
        totalAmount: paymentIntent.amount / 100, // Convert from cents
        paymentStatus: 'paid',
        status: 'pending',
        stripePaymentIntentId: paymentIntent.id,
      };

      const order = await this.orderService.create(orderData);

      // Clear the cart after successful payment
      if (dto.userId) {
        await this.cartService.clearUser(dto.userId);
      } else if (dto.sessionId) {
        await this.cartService.clearSession(dto.sessionId);
      }

      return {
        success: true,
        message: 'Payment confirmed and order created',
        orderId: order._id,
        orderNumber: order.orderNumber,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Payment confirmation failed: ${error.message}`);
    }
  }

  async handleWebhook(event: Stripe.Event) {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log('✓ Payment Intent succeeded:', paymentIntent.id);
          // Update order status if needed
          break;

        case 'payment_intent.payment_failed':
          const failedIntent = event.data.object as Stripe.PaymentIntent;
          console.log('✗ Payment failed:', failedIntent.id);
          // Update order status to failed
          break;

        case 'charge.refunded':
          const refundedCharge = event.data.object as Stripe.Charge;
          console.log('↩ Refund processed:', refundedCharge.id);
          // Update order refund status
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error('Webhook processing error:', error);
      throw error;
    }
  }
}
