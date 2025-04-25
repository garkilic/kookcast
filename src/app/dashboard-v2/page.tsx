'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, sendEmailVerification, deleteUser, getAuth } from 'firebase/auth';
import { doc, getDoc, deleteDoc, updateDoc, getFirestore, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getSurfSpots, SurfSpot } from '@/lib/surfSpots';
import SurfDiaryList from '@/components/SurfDiaryList';
import Link from 'next/link';
import PaymentForm from '@/components/PaymentForm';

import useUserProfile from '@/hooks/useUserProfile';

interface UserData {
  email: string;
  createdAt: string;
  surfLocations: string[];
  surferType: string;
  emailVerified: boolean;
  premium: boolean;
  homeBreak?: string;
  boardTypes: string[];
  displayName?: string;
  photoURL?: string;
  updatedAt?: string;
  selectedSpots?: string[]; // For backward compatibility
}

const boardLabels: Record<string, string> = {
  shortboard: 'Shortboard',
  funboard: 'Funboard/Mini-mal',
  longboard: 'Longboard',
  fish: 'Fish',
  foamie: 'Soft-top/Foamie',
  sup: 'SUP'
};

export default function DashboardV2() {
  // Custom user profile hook
  const {
    userData,
    surfSpots,
    allSpots,
    loading,
    error: userProfileError,
  } = useUserProfile();

  const [isResending, setIsResending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [showSpotPicker, setShowSpotPicker] = useState(false);
  const [selectedSpots, setSelectedSpots] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHomeBreakPicker, setShowHomeBreakPicker] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const router = useRouter();

  // Keep selectedSpots in sync with userData
  useEffect(() => {
    const spots = userData?.surfLocations || [];
    setSelectedSpots(spots);
    setIsVerified(userData?.emailVerified || false);
  }, [userData]);

  // Add a refresh mechanism to check verification status
  const refreshVerificationStatus = async () => {
    if (typeof window !== 'undefined' && window.location) {
      // Soft reload the page to re-trigger hooks and update verification
      window.location.reload();
    }
  };

  const handleResendVerification = async () => {
    const { auth } = await import('@/lib/firebase');
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
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) return;
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }
    setIsDeleting(true);
    setError('');
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid));
      await deleteUser(auth.currentUser);
      router.push('/');
    } catch (error: any) {
      setError(error.message);
      setIsDeleting(false);
    }
  };

  const handleSpotSelect = (spotId: string) => {
    if (!userData?.premium && selectedSpots.length >= 1 && !selectedSpots.includes(spotId)) {
      setShowUpgradeModal(true);
      return;
    }
    setSelectedSpots(prev => {
      if (prev.includes(spotId)) {
        return prev.filter(id => id !== spotId);
      } else {
        return [...prev, spotId];
      }
    });
  };

  const handleUpdateSpots = async () => {
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) return;
    setIsUpdating(true);
    setUpdateError('');
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        surfLocations: selectedSpots,
        updatedAt: new Date().toISOString(),
      });
      setShowSpotPicker(false);
    } catch (error: any) {
      setUpdateError(error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetHomeBreak = async (spotId: string) => {
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) return;
    setIsUpdating(true);
    setUpdateError('');
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        homeBreak: spotId,
        updatedAt: new Date().toISOString(),
      });
      setShowHomeBreakPicker(false);
    } catch (error: any) {
      setUpdateError(error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Inline CancelSubscriptionButton (Firestore-based)
  const CancelSubscriptionButton = () => {
    const [isCancelling, setIsCancelling] = useState(false);
    const handleCancelSubscription = async () => {
      if (!window.confirm('Are you sure you want to cancel your Kook+ subscription?')) {
        return;
      }
      setIsCancelling(true);
      try {
        const authInstance = getAuth();
        const dbInstance = getFirestore();
        const user = authInstance.currentUser;
        if (!user) {
          alert('You must be logged in.');
          return;
        }

        // Get the customer document
        const customerRef = doc(dbInstance, 'customers', user.uid);
        const customerSnap = await getDoc(customerRef);
        
        if (!customerSnap.exists()) {
          alert('No customer record found.');
          return;
        }

        // Get the subscriptions subcollection
        const subscriptionsRef = collection(dbInstance, 'customers', user.uid, 'subscriptions');
        const subscriptionsSnap = await getDocs(subscriptionsRef);
        
        if (subscriptionsSnap.empty) {
          alert('No active subscription found.');
          return;
        }

        // Find the active subscription
        const activeSubscription = subscriptionsSnap.docs.find(doc => {
          const data = doc.data();
          return data.status === 'active' && !data.cancel_at_period_end;
        });

        if (!activeSubscription) {
          alert('No active subscription found.');
          return;
        }

        // Update the subscription to cancel at period end
        await updateDoc(doc(dbInstance, 'customers', user.uid, 'subscriptions', activeSubscription.id), {
          cancel_at_period_end: true,
        });

        alert('Subscription cancellation scheduled. It will cancel at the end of the billing period.');
        window.location.reload();
      } catch (error) {
        console.error('Error cancelling subscription:', error);
        alert('Failed to cancel subscription.');
      } finally {
        setIsCancelling(false);
      }
    };

    return (
      <button
        onClick={handleCancelSubscription}
        disabled={isCancelling}
        className="w-full px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors text-sm sm:text-base"
      >
        {isCancelling ? 'Cancelling...' : 'Cancel Subscription'}
      </button>
    );
  };

  // Use error from hook unless local error is set
  const displayError = error || userProfileError;

  if (loading) {
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
        <div className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
              {userData?.premium && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                  Kook+ Member
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="font-medium">Back to Home</span>
              </button>
              <button
                onClick={() => {
                  auth.signOut();
                  router.push('/');
                }}
                className="w-full sm:w-auto px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm sm:text-base"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6 rounded-lg">
              <p className="text-green-700 text-center sm:text-left">{success}</p>
            </div>
          )}

          {/* Error Message */}
          {displayError && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-lg">
              <p className="text-red-700 text-center sm:text-left">{displayError}</p>
            </div>
          )}

          {/* Main Dashboard Content */}
          <div className="space-y-6">
            {/* Welcome Header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg p-6 text-white text-center sm:text-left">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Welcome to Kookcast</h2>
                  <p className="text-blue-100">Your personal surf forecasting assistant</p>
                </div>
                {userData?.premium && (
                  <span className="px-3 py-1 bg-white/20 text-white rounded-full text-sm font-medium">
                    Kook+ Member
                  </span>
                )}
              </div>
            </div>

            {/* Surf Spots Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {userData?.premium ? (
                // Premium user view - show selected spots
                surfSpots.map((spot: SurfSpot) => (
                  <div key={spot.id} className="bg-white rounded-lg shadow p-4 sm:p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg sm:text-xl font-semibold">{spot.name}</h3>
                        <p className="text-sm sm:text-base text-gray-600">{spot.region}</p>
                      </div>
                      {spot.isMostPopular && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                          Popular
                        </span>
                      )}
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Wave Size</span>
                        <span className="font-medium">3-4ft</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Wind</span>
                        <span className="font-medium">Light Offshore</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Tide</span>
                        <span className="font-medium">Rising</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-600">Next update: 5:00 AM</p>
                    </div>
                  </div>
                ))
              ) : (
                // Free user view - show current spot and shadow spots
                <>
                  {/* Current spot */}
                  {surfSpots.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg sm:text-xl font-semibold">{surfSpots[0].name}</h3>
                          <p className="text-sm sm:text-base text-gray-600">{surfSpots[0].region}</p>
                        </div>
                        {surfSpots[0].isMostPopular && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                            Popular
                          </span>
                        )}
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Wave Size</span>
                          <span className="font-medium">3-4ft</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Wind</span>
                          <span className="font-medium">Light Offshore</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Tide</span>
                          <span className="font-medium">Rising</span>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-sm text-gray-600">Next update: 5:00 AM</p>
                      </div>
                    </div>
                  )}

                  {/* Shadow spots with upgrade prompt */}
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="bg-white rounded-lg shadow p-4 sm:p-6 relative group">
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
                      <div className="relative">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg sm:text-xl font-semibold text-gray-400">Premium Spot</h3>
                            <p className="text-sm sm:text-base text-gray-400">Upgrade to unlock</p>
                          </div>
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                            Kook+
                          </span>
                        </div>
                        <div className="mt-4 space-y-2">
                          <div className="flex justify-between text-sm text-gray-400">
                            <span>Wave Size</span>
                            <span>--</span>
                          </div>
                          <div className="flex justify-between text-sm text-gray-400">
                            <span>Wind</span>
                            <span>--</span>
                          </div>
                          <div className="flex justify-between text-sm text-gray-400">
                            <span>Tide</span>
                            <span>--</span>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-blue-600 transition-all duration-300 transform hover:scale-[1.02] text-sm sm:text-base"
                          >
                            Upgrade to Unlock
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <h3 className="text-lg font-semibold mb-4 text-center sm:text-left">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setShowSpotPicker(true)}
                    className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm sm:text-base"
                  >
                    Update Surf Spots
                  </button>
                  <Link
                    href={{
                      pathname: '/profile-setup',
                      query: {
                        email: userData?.email,
                        surferType: userData?.surferType,
                        boardTypes: userData?.boardTypes?.join(','),
                        homeBreak: userData?.homeBreak,
                        surfLocations: userData?.surfLocations?.join(',')
                      }
                    }}
                    className="w-full px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm sm:text-base block text-center"
                  >
                    Update Profile
                  </Link>
                  {userData?.premium && <CancelSubscriptionButton />}
                </div>
              </div>

              {/* User Info Card */}
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <h3 className="text-lg font-semibold mb-4 text-center sm:text-left">Your Profile</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-sm sm:text-base">{userData?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Member Since</p>
                    <p className="font-medium text-sm sm:text-base">
                      {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Surf Location{userData?.premium ? 's' : ''}</p>
                    <p className="font-medium text-sm sm:text-base">
                      {surfSpots.map(spot => spot.name).join(', ') || 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Home Break</p>
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm sm:text-base">
                        {userData?.homeBreak 
                          ? allSpots.find(s => s.id === userData.homeBreak)?.name 
                          : 'Not set'}
                      </p>
                      <button
                        onClick={() => setShowHomeBreakPicker(true)}
                        className="text-blue-500 hover:text-blue-600 text-sm"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Surfer Type</p>
                    <p className="font-medium text-sm sm:text-base">{userData?.surferType || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Boards</p>
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm sm:text-base">
                        {userData?.boardTypes?.length 
                          ? userData.boardTypes.map(board => boardLabels[board]).join(', ')
                          : 'Not set'}
                      </p>
                      <button
                        onClick={() => router.push('/profile-setup')}
                        className="text-blue-500 hover:text-blue-600 text-sm"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Surf Diary Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Surf Diary</h2>
                <Link
                  href="/surf-diary/new"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Entry
                </Link>
              </div>
              <SurfDiaryList />
            </div>

            {/* Email Verification Status */}
            {!isVerified && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
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
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm sm:text-base"
                    >
                      Check Status
                    </button>
                    <button
                      onClick={handleResendVerification}
                      disabled={isResending}
                      className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 text-sm sm:text-base"
                    >
                      {isResending ? 'Sending...' : 'Resend Verification'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Danger Zone */}
            <div className="bg-white rounded-lg shadow p-4 sm:p-6 border border-red-200">
              <h3 className="text-lg font-semibold mb-4 text-red-600 text-center sm:text-left">Danger Zone</h3>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="w-full sm:w-auto px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 text-sm sm:text-base"
              >
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </button>
              <p className="mt-2 text-sm text-gray-600 text-center sm:text-left">
                This will permanently delete your account and all associated data.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Upgrade to Premium</h3>
            <p className="text-gray-600 mb-4">
              To add more surf spots, you need to upgrade to Kook+ Premium.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <PaymentForm
                onSuccess={async () => {
                  const authInstance = getAuth();
                  const db = getFirestore();
                  const user = authInstance.currentUser;

                  if (user) {
                    const userRef = doc(db, 'users', user.uid);
                    const userSnap = await getDoc(userRef);

                    if (userSnap.exists()) {
                      const existingData = userSnap.data();

                      await setDoc(userRef, {
                        ...existingData,
                        premium: true,
                        updatedAt: new Date().toISOString()
                      });
                    }

                    await sendEmailVerification(user);
                  }

                  setShowUpgradeModal(false);
                  window.location.reload(); // Refresh to show updated premium status
                }}
                onCancel={() => setShowUpgradeModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Spot Picker Modal */}
      {showSpotPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Select Your Surf Spots</h3>
                <button
                  onClick={() => setShowSpotPicker(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  ✕
                </button>
              </div>
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search surf spots..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto">
                {allSpots
                  .filter(spot => 
                    spot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    spot.region.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((spot) => {
                    const isLocked = !userData?.premium && !selectedSpots.includes(spot.id) && selectedSpots.length > 0;
                    return (
                      <div
                        key={spot.id}
                        onClick={() => handleSpotSelect(spot.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all relative ${
                          selectedSpots.includes(spot.id)
                            ? 'border-blue-500 bg-blue-50'
                            : isLocked
                            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        {isLocked && (
                          <div className="absolute inset-0 bg-black bg-opacity-20 rounded-lg flex items-center justify-center">
                            <div className="bg-white/80 p-2 rounded-lg flex items-center gap-2">
                              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <span className="text-sm font-medium text-gray-600">Upgrade to Unlock</span>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{spot.name}</h4>
                            <p className="text-sm text-gray-600">{spot.region}</p>
                          </div>
                          {spot.isMostPopular && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                              Popular
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600">
                      {userData?.premium
                        ? 'Select up to 5 spots'
                        : 'Free users can select 1 spot'}
                    </p>
                    {updateError && (
                      <p className="text-sm text-red-500 mt-2">{updateError}</p>
                    )}
                  </div>
                  <button
                    onClick={handleUpdateSpots}
                    disabled={isUpdating || selectedSpots.length === 0}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Home Break Picker Modal */}
      {showHomeBreakPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Set Your Home Break</h3>
                <button
                  onClick={() => setShowHomeBreakPicker(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  ✕
                </button>
              </div>
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search surf spots..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto">
                {allSpots
                  .filter(spot => 
                    spot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    spot.region.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((spot) => (
                    <div
                      key={spot.id}
                      onClick={() => handleSetHomeBreak(spot.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        userData?.homeBreak === spot.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{spot.name}</h4>
                          <p className="text-sm text-gray-600">{spot.region}</p>
                        </div>
                        {spot.isMostPopular && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                            Popular
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">
                    Select your main surf spot
                  </p>
                  {updateError && (
                    <p className="text-sm text-red-500 mt-2">{updateError}</p>
                  )}
                </div>
                <button
                  onClick={() => setShowHomeBreakPicker(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 