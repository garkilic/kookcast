import { getAuth } from 'firebase/auth';
import { useState } from 'react';

const CancelSubscriptionButton = () => {
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your Kook+ subscription? You will lose access to premium features at the end of your billing period.')) {
      return;
    }

    setIsCancelling(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('You must be signed in.');
      }

      // Force token refresh and get new token
      const token = await user.getIdToken(true);
      console.log('Got fresh token:', token.substring(0, 10) + '...');

      const res = await fetch('/api/cancel-subscription-directly', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      console.log('Response status:', res.status);
      const text = await res.text();
      console.log('Response text:', text);

      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error('Failed to parse server response as JSON:', err);
        throw new Error('Invalid server response');
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to cancel subscription');
      }

      alert('Subscription cancelled successfully.');
      window.location.reload(); // Refresh to reflect downgraded access
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      alert(error.message || 'Unexpected error cancelling subscription.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <button
      onClick={handleCancelSubscription}
      disabled={isCancelling}
      className="w-full px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 text-sm sm:text-base"
    >
      {isCancelling ? 'Cancelling...' : 'Cancel Kook+ Subscription'}
    </button>
  );
};

export default CancelSubscriptionButton; 