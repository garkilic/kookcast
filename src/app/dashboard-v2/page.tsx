'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, sendEmailVerification, deleteUser } from 'firebase/auth';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSurfSpots, SurfSpot } from '@/lib/surfSpots';

interface UserData {
  email: string;
  createdAt: string;
  surfLocation: string;
  surferType: string;
  emailVerified: boolean;
}

export default function DashboardV2() {
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [surfSpot, setSurfSpot] = useState<SurfSpot | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const router = useRouter();

  useEffect(() => {
    console.log('DashboardV2 mounted');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user);
      
      if (!user) {
        console.log('No user found, redirecting to home');
        router.push('/');
        return;
      }

      // Check email verification status
      setIsVerified(user.emailVerified);
      
      try {
        // Get user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserData;
          setUserData(data);

          // Fetch surf spot details
          if (data.surfLocation) {
            const spots = await getSurfSpots();
            const spot = spots.find(s => s.id === data.surfLocation);
            if (spot) {
              setSurfSpot(spot);
            }
          }
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Add a refresh mechanism to check verification status
  const refreshVerificationStatus = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setIsVerified(auth.currentUser.emailVerified);
      if (auth.currentUser.emailVerified) {
        setSuccess('Email verified successfully!');
      }
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    
    setIsResending(true);
    setError('');
    setSuccess('');
    
    try {
      await sendEmailVerification(auth.currentUser);
      setSuccess('Verification email sent! Please check your inbox.');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsResending(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }
    
    setIsDeleting(true);
    setError('');
    
    try {
      // Delete user data from Firestore
      await deleteDoc(doc(db, 'users', auth.currentUser.uid));
      
      // Delete the user account
      await deleteUser(auth.currentUser);
      
      router.push('/');
    } catch (error: any) {
      setError(error.message);
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <button
              onClick={() => {
                auth.signOut();
                router.push('/');
              }}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
              <p className="text-green-700">{success}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* User Info Card */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Your Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">Email</p>
                <p className="font-medium">{userData?.email}</p>
              </div>
              <div>
                <p className="text-gray-600">Member Since</p>
                <p className="font-medium">
                  {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Surf Location</p>
                <p className="font-medium">{surfSpot?.name || userData?.surfLocation || 'Not set'}</p>
              </div>
              <div>
                <p className="text-gray-600">Surfer Type</p>
                <p className="font-medium">{userData?.surferType || 'Not set'}</p>
              </div>
            </div>
          </div>

          {/* Email Verification Status */}
          {!isVerified && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      Your email is not verified. Please check your inbox for the verification link.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={refreshVerificationStatus}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Check Status
                  </button>
                  <button
                    onClick={handleResendVerification}
                    disabled={isResending}
                    className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
                  >
                    {isResending ? 'Sending...' : 'Resend Verification'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => router.push('/profile-setup')}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Update Profile
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                View Homepage
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white shadow rounded-lg p-6 mt-6 border border-red-200">
            <h2 className="text-xl font-semibold mb-4 text-red-600">Danger Zone</h2>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete Account'}
            </button>
            <p className="mt-2 text-sm text-gray-600">
              This will permanently delete your account and all associated data.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
} 