import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSurfSpots, SurfSpot } from '@/lib/surfSpots';
import { useRouter } from 'next/navigation';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Add development mode flag
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

type Step = 'spot' | 'surferType' | 'credentials' | 'verify' | 'payment';

interface MultiStepSignUpFreeProps {
  onUpgradeToPremium: () => void;
  initialSpot?: string | null;
  initialEmail?: string;
}

export default function MultiStepSignUpFree({ onUpgradeToPremium, initialSpot, initialEmail }: MultiStepSignUpFreeProps) {
  const [step, setStep] = useState<Step>('spot');
  const [selectedSpot, setSelectedSpot] = useState<string | null>(initialSpot || null);
  const [surferType, setSurferType] = useState('');
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [spots, setSpots] = useState<SurfSpot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllSpots, setShowAllSpots] = useState(false);
  const SPOTS_TO_SHOW = 4;
  const router = useRouter();

  useEffect(() => {
    const fetchSpots = async () => {
      const surfSpots = await getSurfSpots();
      setSpots(surfSpots);
    };
    fetchSpots();
  }, []);

  const handleSpotSelect = (spotId: string) => {
    if (selectedSpot === spotId) {
      setSelectedSpot(null);
    } else {
      setSelectedSpot(spotId);
    }
  };

  const handleSurferTypeSubmit = () => {
    setStep('credentials');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email) {
        setError('Email is required');
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!IS_DEVELOPMENT) {
        await sendEmailVerification(user);
      }

      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        createdAt: new Date().toISOString(),
        surfLocations: selectedSpot ? [selectedSpot] : [],
        surferType,
        emailVerified: IS_DEVELOPMENT,
        isPremium: false,
      });

      // Send signup notification
      try {
        const functions = getFunctions();
        const sendSignupNotification = httpsCallable(functions, 'sendSignupNotification');
        await sendSignupNotification({ email: user.email });
      } catch (notificationError) {
        console.error('Error sending signup notification:', notificationError);
      }

      // Schedule sync for 2 minutes after signup
      setTimeout(async () => {
        try {
          const response = await fetch('https://api-ovbmv2dgfq-uc.a.run.app/sync-email-verification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uid: user.uid }),
          });

          if (!response.ok) {
            console.error('Failed to sync email verification status:', await response.text());
          }
        } catch (syncError) {
          console.error('Error syncing email verification status:', syncError);
        }
      }, 120000); // 2 minutes in milliseconds

      setVerificationSent(true);
      setStep('verify');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredSpots = spots.filter(spot => 
    spot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    spot.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedSpots = showAllSpots ? filteredSpots : filteredSpots.slice(0, SPOTS_TO_SHOW);
  const hasMoreSpots = filteredSpots.length > SPOTS_TO_SHOW;

  const handleNext = async () => {
    if (step === 'spot') {
      if (!selectedSpot) {
        setError('Please select a spot');
        return;
      }
    }
    if (step === 'credentials') {
      if (!email) {
        setError('Please enter your email');
        return;
      }
      if (!password) {
        setError('Please enter a password');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }
    setStep(step === 'spot' ? 'surferType' : 'credentials');
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {error && <p className="text-red-500 mb-4">{error}</p>}
      
      {step === 'spot' && (
        <div className="space-y-6">
          <h3 className="text-xl sm:text-2xl font-semibold mb-4 text-center">Choose Your Surf Spot</h3>
          <div className="relative">
            <input
              type="text"
              placeholder="Search spots..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {displayedSpots.map((spot) => {
              const isSelected = selectedSpot === spot.id;
              const isLocked = selectedSpot !== null && !isSelected;
              
              return (
                <button
                  key={spot.id}
                  onClick={() => handleSpotSelect(spot.id)}
                  disabled={isLocked}
                  className={`p-3 sm:p-4 border rounded-lg transition-all duration-200 relative ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : isLocked
                        ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                        : spot.isMostPopular 
                          ? 'border-2 border-purple-500 bg-purple-50 hover:border-purple-600 hover:bg-purple-100' 
                          : 'hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  {spot.isMostPopular && (
                    <div className="absolute -top-2 left-2 bg-purple-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                      Popular
                    </div>
                  )}
                  {isLocked && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                      <div className="text-center">
                        <div className="text-gray-500 mb-2">🔒</div>
                        <div className="text-sm text-gray-600">Upgrade to Kook+ to select multiple spots</div>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-1 sm:gap-2">
                    <div className="font-medium text-base sm:text-lg">{spot.name}</div>
                    <div className="text-xs sm:text-sm text-gray-600">{spot.region}</div>
                    <div className="text-xs sm:text-sm text-gray-500 line-clamp-2">{spot.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {!showAllSpots && spots.length > SPOTS_TO_SHOW && (
            <button
              onClick={() => setShowAllSpots(true)}
              className="w-full text-center text-blue-500 hover:text-blue-600 py-2"
            >
              Show All Spots
            </button>
          )}
          {selectedSpot && (
            <div className="sticky bottom-0 bg-white pt-4 mt-4 border-t border-gray-200">
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setStep('surferType')}
                  className="w-full bg-blue-500 text-white px-4 sm:px-6 py-3 rounded-lg hover:bg-blue-600"
                >
                  Continue with Free
                </button>
                <div className="p-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg text-white">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="font-semibold text-lg">Want More Spots?</h4>
                      <p className="text-sm text-white/90">Upgrade to Kook+ to track multiple surf spots</p>
                    </div>
                    <button
                      onClick={onUpgradeToPremium}
                      className="w-full sm:w-auto px-6 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                    >
                      Upgrade to Kook+
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'surferType' && (
        <div className="space-y-6">
          <h3 className="text-xl sm:text-2xl font-semibold mb-4 text-center">Describe Your Surfing Style</h3>
          <textarea
            value={surferType}
            onChange={(e) => setSurferType(e.target.value)}
            placeholder="Example: I'm a beginner who loves small, clean waves. I'm working on my pop-up and catching unbroken waves..."
            className="w-full p-3 sm:p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px] text-sm sm:text-base"
          />
          <div className="flex justify-between">
            <button
              onClick={() => setStep('spot')}
              className="text-blue-500 hover:text-blue-600 text-sm sm:text-base"
            >
              ← Back
            </button>
            <button
              onClick={handleSurferTypeSubmit}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm sm:text-base"
              disabled={!surferType.trim()}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 'credentials' && (
        <form onSubmit={handleSignUp} className="space-y-6">
          <h3 className="text-xl sm:text-2xl font-semibold mb-4 text-center">Create Your Account</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                required
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                required
              />
            </div>
          </div>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep('surferType')}
              className="text-blue-500 hover:text-blue-600 text-sm sm:text-base"
            >
              ← Back
            </button>
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-600 text-sm sm:text-base"
              disabled={loading}
            >
              {loading ? 'Signing up...' : 'Sign Up'}
            </button>
          </div>
        </form>
      )}

      {step === 'verify' && (
        <div className="text-center space-y-6">
          <h3 className="text-xl sm:text-2xl font-semibold">Verify Your Email</h3>
          {IS_DEVELOPMENT ? (
            <p className="text-sm sm:text-base text-gray-600">
              Development Mode: Email verification is bypassed. You can proceed to the dashboard.
            </p>
          ) : (
            <p className="text-sm sm:text-base text-gray-600">
              We've sent a verification email to {email}. Please check your inbox and click the verification link.
            </p>
          )}
          <div className="flex flex-col gap-4">
            {IS_DEVELOPMENT && (
              <button
                onClick={() => {
                  router.push('/dashboard-v2');
                }}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm sm:text-base"
              >
                Go to Dashboard
              </button>
            )}
            <button
              onClick={() => setStep('credentials')}
              className="text-blue-500 hover:text-blue-600 text-sm sm:text-base"
            >
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 