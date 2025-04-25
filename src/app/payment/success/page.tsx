'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { auth } from '@/lib/firebase';

export default function PaymentSuccess() {
  const router = useRouter();

  useEffect(() => {
    const updateUserPremiumStatus = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          // Update user's premium status in Firestore
          await updateDoc(doc(db, 'users', user.uid), {
            isPremium: true,
            premiumActivatedAt: new Date().toISOString(),
          });

          // Redirect to dashboard after a short delay
          setTimeout(() => {
            router.push('/dashboard-v2');
          }, 2000);
        } catch (error) {
          console.error('Error updating premium status:', error);
        }
      }
    };

    updateUserPremiumStatus();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md text-center">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-4">
          Thank you for upgrading to Kook+! Your premium features are now activated.
        </p>
        <p className="text-sm text-gray-500">
          Redirecting to your dashboard...
        </p>
      </div>
    </div>
  );
} 