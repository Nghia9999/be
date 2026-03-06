import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CartService } from '../cart/cart.service';
import { OrderService } from '../order/order.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateOrderDto } from '../order/dto/create-order.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { ConfirmCheckoutSessionDto } from './dto/confirm-checkout-session.dto';

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

  private normalizeCurrency(currency?: string) {
    return (currency || 'vnd').toLowerCase();
  }

  // Stripe uses "smallest currency unit". Some currencies (e.g. VND) are zero-decimal.
  private isZeroDecimalCurrency(currency: string) {
    // Source: Stripe zero-decimal currencies list (common subset).
    const ZERO_DECIMAL = new Set([
      'bif',
      'clp',
      'djf',
      'gnf',
      'jpy',
      'kmf',
      'krw',
      'mga',
      'pyg',
      'rwf',
      'ugx',
      'vnd',
      'vuv',
      'xaf',
      'xof',
      'xpf',
    ]);
    return ZERO_DECIMAL.has(currency);
  }

  private toStripeAmount(amount: number, currency: string) {
    if (!Number.isFinite(amount)) throw new BadRequestException('Invalid amount');
    if (amount <= 0) throw new BadRequestException('Amount must be greater than 0');
    return this.isZeroDecimalCurrency(currency)
      ? Math.round(amount)
      : Math.round(amount * 100);
  }

  private fromStripeAmount(amount: number, currency: string) {
    return this.isZeroDecimalCurrency(currency) ? amount : amount / 100;
  }

  async createPaymentIntent(dto: CreatePaymentIntentDto) {
    try {
      const currency = this.normalizeCurrency(dto.currency);
      const stripeAmount = this.toStripeAmount(dto.amount, currency);

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: stripeAmount,
        currency,
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
        currency,
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

      const currency = this.normalizeCurrency(paymentIntent.currency);
      const cartItems = await this.cartService.findBySessionOrUser(
        dto.sessionId,
        dto.userId,
      );

      if (!cartItems || cartItems.length === 0) {
        throw new BadRequestException('Cart is empty. Cannot create order.');
      }

      // Create order in database
      const orderData: CreateOrderDto = {
        userId: dto.userId ?? undefined,
        items: cartItems.map((item) => ({
          id: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          size: item.size,
          color: item.color,
        })),
        customerInfo: dto.customerInfo,
        totalAmount: this.fromStripeAmount(paymentIntent.amount, currency),
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

  async createCheckoutSession(dto: CreateCheckoutSessionDto) {
    const currency = this.normalizeCurrency(dto.currency);
    const items = dto.items || [];

    if (!items.length) {
      throw new BadRequestException('Cart is empty');
    }

    const frontendEnv = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    // If multiple origins are configured, use the first one as base URL for redirects.
    const frontendBase = (frontendEnv.split(',')[0] || 'http://localhost:3000')
      .trim()
      .replace(/\/+$/, '');

    const totalAmount = items.reduce((sum, item) => {
      const price = typeof item?.price === 'number' ? item.price : 0;
      const quantity = typeof item?.quantity === 'number' ? item.quantity : 1;
      return sum + price * quantity;
    }, 0);

    if (totalAmount <= 0) {
      throw new BadRequestException('Total amount must be greater than 0');
    }

    // Create an order first (pending). Webhook will mark as paid.
    const order = await this.orderService.create({
      userId: dto.userId ?? undefined,
      items: items.map((i) => ({
        id: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        image: i.image,
        size: i.size,
        color: i.color,
      })),
      customerInfo: dto.customerInfo,
      totalAmount,
      paymentStatus: 'pending',
      status: 'pending',
    });

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item) => {
      const maybeImages =
        typeof item.image === 'string' && /^https?:\/\//i.test(item.image)
          ? [item.image]
          : undefined;

      const description = `${item.size ? `Size: ${item.size}` : ''}${
        item.size && item.color ? ' | ' : ''
      }${item.color ? `Color: ${item.color}` : ''}`.trim();

      return {
        price_data: {
          currency,
          product_data: {
            name: item.name,
            ...(description ? { description } : {}),
            ...(maybeImages ? { images: maybeImages } : {}),
          },
          unit_amount: this.toStripeAmount(item.price, currency),
        },
        quantity: item.quantity,
      };
    });

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${frontendBase}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBase}/cart`,
      customer_email: dto.customerInfo?.email,
      billing_address_collection: 'required',
      metadata: {
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        userId: dto.userId ? String(dto.userId) : '',
        sessionId: dto.sessionId ? String(dto.sessionId) : '',
      },
    });

    await this.orderService.update(order._id, {
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
    } as any);

    return {
      url: session.url,
      sessionId: session.id,
      orderId: order._id,
      orderNumber: order.orderNumber,
    };
  }

  async getOrderByCheckoutSession(sessionId: string) {
    const order = await this.orderService.findByStripeSessionId(sessionId);
    if (!order) {
      throw new BadRequestException('Order not found for this session');
    }
    return order;
  }

  async confirmCheckoutSession(dto: ConfirmCheckoutSessionDto) {
    const sessionId = dto.sessionId;
    if (!sessionId) throw new BadRequestException('sessionId is required');

    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    if (!session) throw new BadRequestException('Checkout session not found');

    // Stripe Checkout: `payment_status` should be 'paid' after successful payment.
    if ((session as any).payment_status !== 'paid') {
      throw new BadRequestException(
        `Checkout session is not paid (payment_status=${(session as any).payment_status})`,
      );
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent as any)?.id;

    const meta = (session.metadata || {}) as Record<string, string>;
    const orderId = meta.orderId;
    const userId = meta.userId || undefined;
    const cartSessionId = meta.sessionId || undefined;

    let order =
      (orderId ? await this.orderService.findOne(orderId) : null) ||
      (await this.orderService.findByStripeSessionId(session.id));

    if (!order) {
      throw new BadRequestException('Order not found for this checkout session');
    }

    order = await this.orderService.update(order._id, {
      paymentStatus: 'paid',
      status: 'processing',
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
    } as any);

    if (userId) {
      await this.cartService.clearUser(userId);
    } else if (cartSessionId) {
      await this.cartService.clearSession(cartSessionId);
    }

    return order;
  }

  async handleWebhook(event: Stripe.Event) {
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = session.metadata?.orderId;

          if (orderId) {
            await this.orderService.update(orderId, {
              paymentStatus: 'paid',
              status: 'processing',
              stripeSessionId: session.id,
              stripePaymentIntentId:
                typeof session.payment_intent === 'string'
                  ? session.payment_intent
                  : undefined,
            } as any);
          }

          const userId = session.metadata?.userId || undefined;
          const sessionId = session.metadata?.sessionId || undefined;

          if (userId) {
            await this.cartService.clearUser(userId);
          } else if (sessionId) {
            await this.cartService.clearSession(sessionId);
          }

          break;
        }

        case 'payment_intent.succeeded':
          // Elements/PaymentIntent flow
          {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            console.log('✓ Payment Intent succeeded:', paymentIntent.id);
            const existingOrder = await this.orderService.findByStripePaymentIntentId(
              paymentIntent.id,
            );
            if (existingOrder) {
              await this.orderService.update(existingOrder._id, {
                paymentStatus: 'paid',
                status: 'processing',
              } as any);
            }
          }
          break;

        case 'payment_intent.payment_failed':
          {
            const failedIntent = event.data.object as Stripe.PaymentIntent;
            console.log('✗ Payment failed:', failedIntent.id);
            const existingOrder = await this.orderService.findByStripePaymentIntentId(
              failedIntent.id,
            );
            if (existingOrder) {
              await this.orderService.update(existingOrder._id, {
                paymentStatus: 'failed',
              } as any);
            }
          }
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
