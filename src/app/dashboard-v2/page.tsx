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

// Add board options and types
interface BoardOption {
  id: string;
  label: string;
  description: string;
}

const boardOptions: BoardOption[] = [
  { id: 'shortboard', label: 'Shortboard', description: '5\'6" - 6\'4" performance board' },
  { id: 'funboard', label: 'Funboard/Mini-mal', description: '7\'0" - 8\'0" versatile board' },
  { id: 'longboard', label: 'Longboard', description: '9\'0"+ classic longboard' },
  { id: 'fish', label: 'Fish', description: '5\'4" - 6\'0" retro fish' },
  { id: 'foamie', label: 'Soft-top/Foamie', description: 'Beginner-friendly foam board' },
  { id: 'sup', label: 'SUP', description: 'Stand-up paddleboard' }
];

// Import SurferPreferences interface
interface SurferPreferences {
  description: string;
  boardTypes: string[];
}

// Update UserData interface to use SurferPreferences
interface UserData {
  email: string;
  createdAt: string;
  surfLocations: string[];
  surferPreferences: SurferPreferences;
  emailVerified: boolean;
  updatedAt?: string;
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

  const [isVerified, setIsVerified] = useState(true);
  const [showVerificationReminder, setShowVerificationReminder] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [showSpotPicker, setShowSpotPicker] = useState(false);
  const [selectedSpots, setSelectedSpots] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHomeBreakPicker, setShowHomeBreakPicker] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showSurfStyleModal, setShowSurfStyleModal] = useState(false);
  const [showBoardsModal, setShowBoardsModal] = useState(false);
  const [surfStyle, setSurfStyle] = useState('');
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const router = useRouter();

  // Keep selectedSpots in sync with userData
  useEffect(() => {
    const spots = userData?.surfLocations || [];
    setSelectedSpots(spots);
    
    // Check verification status after 5 hours
    const checkVerification = async () => {
      if (!userData?.emailVerified) {
        const fiveHoursInMs = 5 * 60 * 60 * 1000;
        const createdAt = new Date(userData?.createdAt || '').getTime();
        const now = new Date().getTime();
        
        if (now - createdAt >= fiveHoursInMs) {
          setShowVerificationReminder(true);
          setIsVerified(false);
        }
      }
    };
    
    checkVerification();
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
    
  try {
  await sendEmailVerification(auth.currentUser);
  setSuccess('Verification email sent! Please check your inbox.');
} catch (error: any) {
  console.error('Error resending verification email:', error);
  if (error.code) {
    console.error('Error code:', error.code);
  }
  setError(error.message || 'Failed to send verification email. Please try again.');
} finally {
  setIsResending(false);
}
    } finally {
      setIsResending(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) {
      setError('You must be logged in to delete your account.');
      return;
    }

    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    setError('');
    setSuccess('');

    try {
      // First delete the user document from Firestore
      await deleteDoc(doc(db, 'users', auth.currentUser.uid));
      
      // Then delete the user from Firebase Auth
      await deleteUser(auth.currentUser);
      
      setSuccess('Account successfully deleted.');
      router.push('/');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setError(error.message || 'Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  const handleSpotSelect = (spotId: string) => {
    setSelectedSpots([spotId]); // Only allow one spot
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

  // Use error from hook unless local error is set
  const displayError = error || userProfileError;

  // Add update functions
  const handleUpdateSurfStyle = async () => {
    if (!auth.currentUser) return;
    setIsUpdating(true);
    setUpdateError('');
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        'surferPreferences.description': surfStyle,
        updatedAt: new Date().toISOString(),
      });
      setShowSurfStyleModal(false);
    } catch (error: any) {
      setUpdateError(error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateBoards = async () => {
    if (!auth.currentUser) return;
    setIsUpdating(true);
    setUpdateError('');
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        'surferPreferences.boardTypes': selectedBoards,
        updatedAt: new Date().toISOString(),
      });
      setShowBoardsModal(false);
    } catch (error: any) {
      setUpdateError(error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Update useEffect to use nested structure
  useEffect(() => {
    if (userData) {
      setSurfStyle(userData.surferPreferences?.description || '');
      setSelectedBoards(userData.surferPreferences?.boardTypes || []);
    }
  }, [userData]);

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
              </div>
            </div>

            {/* Surf Spots Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {surfSpots.map((spot: SurfSpot) => (
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
                  ))}
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
                    <p className="text-sm text-gray-500">Surf Location</p>
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm sm:text-base">
                        {surfSpots.map(spot => spot.name).join(', ') || 'Not set'}
                      </p>
                      <button
                        onClick={() => setShowSpotPicker(true)}
                        className="text-blue-500 hover:text-blue-600 text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Surfing Style</p>
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm sm:text-base">{userData?.surferPreferences?.description || 'Not set'}</p>
                      <button
                        onClick={() => setShowSurfStyleModal(true)}
                        className="text-blue-500 hover:text-blue-600 text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Boards</p>
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm sm:text-base">
                        {userData?.surferPreferences?.boardTypes?.length 
                          ? userData.surferPreferences.boardTypes.map(board => boardLabels[board]).join(', ')
                          : 'Not set'}
                      </p>
                      <button
                        onClick={() => setShowBoardsModal(true)}
                        className="text-blue-500 hover:text-blue-600 text-sm"
                      >
                        Edit
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
            {showVerificationReminder && !isVerified && (
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

      {/* Spot Picker Modal */}
      {showSpotPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-secondary-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-secondary-900">Update Your Surf Spot</h3>
                <button
                  onClick={() => setShowSpotPicker(false)}
                  className="text-secondary-400 hover:text-secondary-500"
                >
                  ✕
                </button>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-blue-800">
                  Choose your primary surf spot. You can only select one spot at a time.
                </p>
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
                        onClick={() => handleSpotSelect(spot.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedSpots[0] === spot.id
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
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600">
                      Selected spot: {selectedSpots.length > 0 ? allSpots.find(spot => spot.id === selectedSpots[0])?.name : 'None'}
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

      {/* Add new modals for editing surf style and boards */}
      {showSurfStyleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Edit Surfing Style</h3>
                <button
                  onClick={() => setShowSurfStyleModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  ✕
                </button>
              </div>
              <textarea
                value={surfStyle}
                onChange={(e) => setSurfStyle(e.target.value)}
                placeholder="Describe your surfing style and experience..."
                className="w-full p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px]"
              />
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  {updateError && (
                    <p className="text-sm text-red-500">{updateError}</p>
                  )}
                </div>
                <button
                  onClick={handleUpdateSurfStyle}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBoardsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Edit Boards</h3>
                <button
                  onClick={() => setShowBoardsModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {boardOptions.map((board) => (
                  <div
                    key={board.id}
                    onClick={() => {
                      setSelectedBoards(prev =>
                        prev.includes(board.id)
                          ? prev.filter(id => id !== board.id)
                          : [...prev, board.id]
                      );
                    }}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedBoards.includes(board.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <h4 className="font-medium">{board.label}</h4>
                    <p className="text-sm text-gray-600">{board.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  {updateError && (
                    <p className="text-sm text-red-500">{updateError}</p>
                  )}
                </div>
                <button
                  onClick={handleUpdateBoards}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 