import { Controller, Post, Body, Headers } from '@nestjs/common';

// TODO: Install stripe package
// import { Stripe } from 'stripe';

@Controller('webhook')
export class WebhookController {
  // TODO: Initialize Stripe after installing stripe package
  // private stripe: Stripe;

  constructor() {
    // this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    //   apiVersion: '2024-06-20',
    // });
  }

  @Post('stripe')
  async handleStripeWebhook(@Body() body: any, @Headers() headers: any) {
    try {
      const sig = headers['stripe-signature'];
      

      return { received: true };
    } catch (error) {
      console.error('Webhook error:', error);
      throw new Error(`Webhook processing failed: ${error.message}`);
    }
  }

  
}
