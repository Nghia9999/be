import { Controller, Post, Body } from '@nestjs/common';

// TODO: Install stripe and swagger packages
// import { Stripe } from 'stripe';
// import { ApiTags, ApiOperation } from '@nestjs/swagger';

@Controller('payment')
export class PaymentController {
  // TODO: Initialize Stripe after installing stripe package
  // private stripe: Stripe;

  constructor() {
    // this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    //   apiVersion: '2024-06-20',
    // });
  }

  @Post('create-payment-intent')
  async createPaymentIntent(@Body() body: { amount: number; currency?: string }) {
    try {
      // TODO: Implement Stripe PaymentIntent after installing stripe package
      // const paymentIntent = await this.stripe.paymentIntents.create({
      //   amount: Math.round(body.amount * 100), // Convert to cents
      //   currency: body.currency || 'vnd',
      //   automatic_payment_methods: {
      //     enabled: true,
      //     allow_redirects: 'never',
      //   },
      // });

      return {
        message: 'Stripe integration pending - install stripe package',
        // clientSecret: paymentIntent.client_secret,
        // paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      throw new Error(`PaymentIntent creation failed: ${error.message}`);
    }
  }

  @Post('confirm-payment')
  async confirmPayment(@Body() body: { paymentIntentId: string; customerInfo: any; items: any[] }) {
    try {
      // TODO: Implement Stripe confirmation after installing stripe package
      // const paymentIntent = await this.stripe.paymentIntents.retrieve(body.paymentIntentId);
      
      // if (paymentIntent.status === 'succeeded') {
      //   // Create order in database
      //   return { success: true, message: 'Payment confirmed' };
      // } else {
      //   return { success: false, message: 'Payment not successful' };
      // }
      
      return { 
        message: 'Stripe integration pending - install stripe package',
        paymentIntentId: body.paymentIntentId,
        customerInfo: body.customerInfo,
        items: body.items
      };
    } catch (error) {
      throw new Error(`Payment confirmation failed: ${error.message}`);
    }
  }
}
