import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface SubscriptionManagerProps {
  isPremium: boolean;
  onSubscriptionChange?: () => void;
}

export default function SubscriptionManager({ isPremium, onSubscriptionChange }: SubscriptionManagerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleUpgrade = async () => {
    router.push('/signup?type=premium');
  };

  const handleManageSubscription = async () => {
    if (!auth.currentUser) return;

    setLoading(true);
    setError(null);

    try {
      // Get the customer portal URL from your backend
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: auth.currentUser.uid,
          returnUrl: window.location.href,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create portal session');
      }

      // Redirect to the customer portal
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      console.error('Error creating portal session:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Subscription Status</h2>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          isPremium ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {isPremium ? 'Premium' : 'Free'}
        </div>
      </div>

      {isPremium ? (
        <div>
          <div className="mb-4">
            <h3 className="font-medium text-gray-900">Kook+ Premium</h3>
            <p className="text-sm text-gray-600">
              You have access to all premium features including multiple spot tracking,
              advanced forecasts, and priority notifications.
            </p>
          </div>
          <button
            onClick={handleManageSubscription}
            disabled={loading}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Manage Subscription'}
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <h3 className="font-medium text-gray-900">Free Plan</h3>
            <p className="text-sm text-gray-600">
              Upgrade to Kook+ Premium to unlock multiple spot tracking,
              advanced forecasts, and more premium features.
            </p>
          </div>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Upgrade to Premium'}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
} 