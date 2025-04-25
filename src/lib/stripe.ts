import { getStripePayments } from '@invertase/firestore-stripe-payments';
import { getApp } from 'firebase/app';
import { getProducts } from '@invertase/firestore-stripe-payments';
import { getCurrentUserSubscriptions } from '@invertase/firestore-stripe-payments';
import { getFirestore, collection, doc, setDoc, addDoc } from 'firebase/firestore';

// Initialize the Stripe payments SDK
const app = getApp();
const db = getFirestore(app);

// Initialize required Firestore collections
const initializeStripeCollections = async () => {
  try {
    // Create stripe_products collection if it doesn't exist
    const productsCollection = collection(db, 'stripe_products');
    const productsDoc = doc(productsCollection, 'initial');
    await setDoc(productsDoc, { initialized: true }, { merge: true });

    // Create stripe_customers collection if it doesn't exist
    const customersCollection = collection(db, 'stripe_customers');
    const customersDoc = doc(customersCollection, 'initial');
    await setDoc(customersDoc, { initialized: true }, { merge: true });

    console.log('Stripe collections initialized successfully');
  } catch (error) {
    console.error('Error initializing Stripe collections:', error);
  }
};

// Initialize collections
initializeStripeCollections();

export const payments = getStripePayments(app, {
  productsCollection: 'stripe_products',
  customersCollection: 'stripe_customers',
});

// Helper function to create a checkout session
export const createCheckoutSessionHelper = async (priceId: string) => {
  try {
    console.log('Creating checkout session with price ID:', priceId);
    
    if (!priceId) {
      throw new Error('Price ID is required');
    }

    // Verify the price ID format
    if (!priceId.startsWith('price_')) {
      throw new Error('Invalid price ID format. Must start with "price_"');
    }

    // Create a new checkout session in Firestore
    const checkoutSessionRef = await addDoc(collection(db, 'checkout_sessions'), {
      price: priceId,
      success_url: window.location.origin + '/payment/success',
      cancel_url: window.location.origin + '/payment/cancel',
      mode: 'subscription',
      created: new Date().toISOString()
    });

    console.log('Checkout session document created:', checkoutSessionRef.id);
    return checkoutSessionRef;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    throw error;
  }
};

// Helper function to get all products
export const getProductsHelper = async () => {
  try {
    const products = await getProducts(payments, {
      includePrices: true,
      activeOnly: true,
    });
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

// Helper function to get current user's subscriptions
export const getCurrentUserSubscriptionsHelper = async () => {
  try {
    const subscriptions = await getCurrentUserSubscriptions(payments);
    return subscriptions;
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    throw error;
  }
}; 