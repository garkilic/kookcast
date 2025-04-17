import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

// Initialize Stripe with your secret key without specifying the API version
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Monthly price in cents
const MONTHLY_PRICE = 500; // $5.00

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paymentMethodId, email, userId } = req.body;

  if (!paymentMethodId) {
    return res.status(400).json({ error: 'Missing paymentMethodId' });
  }

  try {
    // 1. Create a customer or use existing one
    let customer;
    
    // Check if customer with this email already exists
    if (email) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      
      if (customers.data.length > 0) {
        customer = customers.data[0];
        
        // Update the customer with the new payment method
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customer.id,
        });
        
        // Set as default payment method
        await stripe.customers.update(customer.id, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }
    }
    
    // If no existing customer, create a new one
    if (!customer) {
      customer = await stripe.customers.create({
        payment_method: paymentMethodId,
        email: email || undefined,
        metadata: {
          firebaseUserId: userId || '',
        },
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }

    // 2. Create a payment intent instead of a subscription for simplicity
    const paymentIntent = await stripe.paymentIntents.create({
      amount: MONTHLY_PRICE,
      currency: 'usd',
      customer: customer.id,
      payment_method: paymentMethodId,
      confirm: true,
      description: 'Kook+ Monthly Subscription',
      metadata: {
        firebaseUserId: userId || '',
      },
      // Set automatic payment methods to card only (no redirects)
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      // For immediate confirmation if possible:
      off_session: false,
    });

    // 3. Check if we need further action (3D Secure)
    if (paymentIntent.status === 'requires_action') {
      return res.status(200).json({
        clientSecret: paymentIntent.client_secret,
        requiresAction: true,
      });
    }

    // 4. Payment succeeded
    return res.status(200).json({
      success: true,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error: any) {
    console.error('Stripe error:', error);
    return res.status(400).json({ error: error.message });
  }
} 