import { useState, FC } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc as firestoreDoc, addDoc, onSnapshot } from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe('pk_test_51REGmDCKpNGLkmsGVt0NT8thUxrD9MKt11KqoSJzuZNUgz1lcE7lxye6vV37my8yV36JA6SmDBLmwXZaSik5fhNc00Nb10iqES');

export interface PaymentFormProps {
  onSuccess: () => void | Promise<void>;
  onCancel: () => void;
}

const PaymentForm: FC<PaymentFormProps> = ({ onSuccess, onCancel }) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setProcessing(true);
    setError('');

    try {
      console.log('Starting Stripe checkout process...');
      const authInstance = getAuth();
      const db = getFirestore();
      const user = authInstance.currentUser;

      if (!user) {
        throw new Error('User not logged in');
      }

      console.log('Creating checkout session for user:', user.uid);
      const checkoutRef = collection(firestoreDoc(db, 'customers', user.uid), 'checkout_sessions');
      const docRef = await addDoc(checkoutRef, {
        price: 'price_1RHZdvCKpNGLkmsGfABymF8f',
        success_url: window.location.origin + '/dashboard-v2',
        cancel_url: window.location.origin + '/cancel',
        mode: 'subscription'
      });

      console.log('Checkout session created, waiting for URL...');
      onSnapshot(docRef, async (snap) => {
        const data = snap.data();
        console.log('Checkout session data:', data);
        
        if (data?.error) {
          console.error('Stripe error:', data.error);
          setError(data.error.message);
          setProcessing(false);
          return;
        }

        if (data?.url) {
          console.log('Redirecting to Stripe checkout...');
          const stripe = await stripePromise;
          if (stripe) {
            window.location.assign(data.url);
          } else {
            console.error('Stripe not initialized');
            setError('Payment system not available');
            setProcessing(false);
          }
        }
      });

    } catch (err: any) {
      console.error('Error in payment process:', err);
      setError(err.message || 'An error occurred during payment');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow">
        <p className="text-gray-600">Premium membership will be activated after signup.</p>
      </div>
      {error && (
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={processing}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {processing ? 'Processing...' : 'Continue'}
        </button>
      </div>
    </form>
  );
};

export default PaymentForm; 