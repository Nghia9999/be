import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CartService } from '../cart/cart.service';
import { OrderService } from '../order/order.service';
import { CreateOrderDto } from '../order/dto/create-order.dto';

@Injectable()
export class PaymentService {
  constructor(
    private cartService: CartService,
    private orderService: OrderService,
  ) {}

  async createPaymentIntent(userId?: string, sessionId?: string) {
    // Get cart items
    const cartItems = await this.cartService.findBySessionOrUser(sessionId, userId);
    
    if (cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    // Calculate total
    const totalAmount = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);

    // TODO: Integrate with Stripe here
    // For now, return mock payment intent
    return {
      clientSecret: `pi_test_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
      amount: totalAmount,
      currency: 'vnd',
    };
  }

  async confirmPayment(
    paymentIntentId: string,
    customerInfo: any,
    userId?: string,
    sessionId?: string
  ) {
    try {
      // Get cart items
      const cartItems = await this.cartService.findBySessionOrUser(sessionId, userId);
      
      if (cartItems.length === 0) {
        throw new Error('Cart is empty');
      }

      // Create order
      const orderData: CreateOrderDto = {
        userId: userId || null,
        items: cartItems.map(item => ({
          id: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          size: item.size,
          color: item.color,
        })),
        customerInfo,
        totalAmount: cartItems.reduce((total, item) => total + (item.price * item.quantity), 0),
        paymentStatus: 'paid', // Payment successful
        status: 'pending', // Order processing
        stripePaymentIntentId: paymentIntentId,
      };

      const order = await this.orderService.create(orderData);

      // Clear cart after successful payment
      if (userId) {
        await this.cartService.clearUser(userId);
      } else if (sessionId) {
        await this.cartService.clearSession(sessionId);
      }

      return {
        success: true,
        orderId: order._id,
        orderNumber: order.orderNumber,
      };

    } catch (error) {
      console.error('Payment confirmation error:', error);
      throw new Error('Payment confirmation failed');
    }
  }
}
