import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CartService } from '../cart/cart.service';
import { OrderService } from '../order/order.service';
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

  async createCheckoutSession(dto: CreateCheckoutSessionDto, userId?: string) {
    const currency = this.normalizeCurrency(dto.currency);
    const orderUserId = userId ?? dto.userId ?? undefined;

    let items: Array<{ productId?: string; name: string; price: number; quantity: number; image?: string; size?: string; color?: string }>;
    let customerInfo: CreateCheckoutSessionDto['customerInfo'];
    let existingOrder: Awaited<ReturnType<typeof this.orderService.findOne>> = null;
    let totalAmount: number;

    if (dto.orderId && orderUserId) {
      existingOrder = await this.orderService.findOne(dto.orderId);
      if (!existingOrder) throw new BadRequestException('Đơn hàng không tồn tại');
      if (existingOrder.userId !== orderUserId) throw new BadRequestException('Bạn không có quyền thanh toán đơn này');
      if (existingOrder.paymentStatus !== 'pending') throw new BadRequestException('Đơn hàng đã thanh toán hoặc không thể thanh toán');
      items = existingOrder.items.map((i) => ({
        productId: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        image: i.image,
        size: i.size,
        color: i.color,
      }));
      customerInfo = existingOrder.customerInfo;
      totalAmount = existingOrder.totalAmount;
    } else {
      items = dto.items || [];
      if (!items.length) throw new BadRequestException('Giỏ hàng trống');
      customerInfo = dto.customerInfo;
      if (!customerInfo) throw new BadRequestException('Thiếu thông tin giao hàng');
      totalAmount = items.reduce((sum, item) => {
        const price = typeof item?.price === 'number' ? item.price : 0;
        const quantity = typeof item?.quantity === 'number' ? item.quantity : 1;
        return sum + price * quantity;
      }, 0);
    }

    if (totalAmount <= 0) {
      throw new BadRequestException('Total amount must be greater than 0');
    }

    const frontendEnv = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const frontendBase = (frontendEnv.split(',')[0] || 'http://localhost:3000')
      .trim()
      .replace(/\/+$/, '');

    if (!existingOrder) {
      existingOrder = await this.orderService.create({
        userId: orderUserId,
        items: items.map((i) => ({
          id: i.productId || i.name,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          image: i.image || '',
          size: i.size,
          color: i.color,
        })),
        customerInfo,
        totalAmount,
        paymentStatus: 'pending',
        status: 'pending',
      });
    }

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
      cancel_url: dto.orderId ? `${frontendBase}/orders` : `${frontendBase}/cart`,
      customer_email: customerInfo?.email,
      billing_address_collection: 'required',
      metadata: {
        orderId: String(existingOrder._id),
        orderNumber: existingOrder.orderNumber,
        userId: orderUserId ? String(orderUserId) : '',
        sessionId: dto.sessionId ? String(dto.sessionId) : '',
      },
    });

    await this.orderService.update(existingOrder._id, {
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
    } as any);

    return {
      url: session.url,
      sessionId: session.id,
      orderId: existingOrder._id,
      orderNumber: existingOrder.orderNumber,
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
