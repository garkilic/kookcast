import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

// Initialize Stripe
const stripe = new Stripe(stripeSecretKey.value(), {
  apiVersion: '2025-03-31.basil',
});

export const createPortalSession = onCall({
  secrets: [stripeSecretKey],
}, async (request) => {
  try {
    const { returnUrl } = request.data;
    
    if (!returnUrl) {
      throw new Error('Missing required field: returnUrl');
    }

    if (!request.auth?.uid) {
      throw new Error('User not authenticated');
    }

    // Get the user's customer ID from Firestore
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(request.auth.uid)
      .get();

    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    if (!userData?.stripeCustomerId) {
      throw new Error('User has no associated Stripe customer');
    }

    // Create a Stripe customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripeCustomerId,
      return_url: returnUrl,
    });

    return {
      url: session.url
    };
  } catch (error: any) {
    console.error('Error creating Stripe customer portal session:', error);
    throw new Error(error.message);
  }
}); 