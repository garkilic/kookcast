import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSurfSpots, SurfSpot } from '@/lib/surfSpots';
import { useRouter } from 'next/navigation';

// Add development mode flag
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

type Step = 'spot' | 'surferType' | 'credentials' | 'verify' | 'payment';

interface SurferPreferences {
  description: string;
  boardTypes: string[];
}

interface MultiStepSignUpFreeProps {
  initialSpot?: string | null;
  initialEmail?: string;
}

export default function MultiStepSignUpFree({ 
  initialSpot, 
  initialEmail 
}: MultiStepSignUpFreeProps) {
  const [step, setStep] = useState<Step>('spot');
  const [selectedSpot, setSelectedSpot] = useState<string | null>(initialSpot || null);
  const [surferPreferences, setSurferPreferences] = useState<SurferPreferences>({
    description: '',
    boardTypes: []
  });
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
    // If trying to select more than 5 spots, show error
    if (selectedSpot && selectedSpot !== spotId) {
      setError('You can select up to 5 spots. Please remove a spot before adding another.');
      return;
    }

    if (selectedSpot === spotId) {
      setSelectedSpot(null);
    } else {
      setSelectedSpot(spotId);
    }
  };

  const handleSurferTypeSubmit = () => {
    setStep('credentials');
  };

  const boardOptions = [
    { id: 'shortboard', label: 'Shortboard', description: '5\'6" - 6\'4" performance board' },
    { id: 'funboard', label: 'Funboard/Mini-mal', description: '7\'0" - 8\'0" versatile board' },
    { id: 'longboard', label: 'Longboard', description: '9\'0"+ classic longboard' },
    { id: 'fish', label: 'Fish', description: '5\'4" - 6\'0" retro fish' },
    { id: 'foamie', label: 'Soft-top/Foamie', description: 'Beginner-friendly foam board' },
    { id: 'sup', label: 'SUP', description: 'Stand-up paddleboard' }
  ];

  const toggleBoardType = (boardId: string) => {
    setSurferPreferences(prev => ({
      ...prev,
      boardTypes: prev.boardTypes.includes(boardId)
        ? prev.boardTypes.filter(id => id !== boardId)
        : [...prev.boardTypes, boardId]
    }));
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

      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user document in Firestore first
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        createdAt: new Date().toISOString(),
        surfLocations: selectedSpot ? [selectedSpot] : [],
        surferPreferences: {
          description: surferPreferences.description,
          boardTypes: surferPreferences.boardTypes
        },
        emailVerified: false,
        premium: false,
      });

      // Send email verification with improved configuration
      try {
        const verificationUrl = process.env.NODE_ENV === 'production' 
          ? 'https://kook-cast.com/auth/verify-email'
          : `${window.location.origin}/auth/verify-email`;
        console.log('Sending verification email with URL:', verificationUrl);
        
        await sendEmailVerification(user, {
          url: verificationUrl,
          handleCodeInApp: true
        });
        setVerificationSent(true);
      } catch (verificationError: any) {
        console.error('Verification email error:', verificationError);
        // Log specific error details
        if (verificationError.code) {
          console.error('Error code:', verificationError.code);
        }
        if (verificationError.message) {
          console.error('Error message:', verificationError.message);
        }
        // Don't throw error here, just log it and continue
        // The user can still request a new verification email later
      }

      setStep('verify');
    } catch (error: any) {
      console.error('Signup error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (error.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters long.');
      } else {
        setError(error.message || 'An error occurred during signup. Please try again.');
      }
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
              const isGreyedOut = selectedSpot !== null && !isSelected;
              
              return (
                <button
                  key={spot.id}
                  onClick={() => handleSpotSelect(spot.id)}
                  disabled={isGreyedOut}
                  className={`p-3 sm:p-4 border rounded-lg transition-all duration-200 relative ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : isGreyedOut
                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
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
                      <p className="text-sm text-white/90">Coming soon: Track multiple surf spots</p>
                    </div>
                    <button
                      disabled
                      className="w-full sm:w-auto px-6 py-2 bg-white/20 text-white rounded-lg font-medium cursor-not-allowed"
                    >
                      Coming Soon
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'surferType' && (
        <div className="space-y-8">
          <div>
            <h3 className="text-xl sm:text-2xl font-semibold mb-2 text-center">Tell Us About Your Surfing</h3>
            <p className="text-gray-600 text-center mb-6">
              Our AI uses your surfing style and experience to provide personalized recommendations. The more you tell us, the better we can match conditions to your abilities and preferences.
            </p>
          </div>

          {/* Board Types */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">What type of board(s) do you ride? <span className="text-sm text-gray-500">(Select all that apply)</span></h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {boardOptions.map((board) => (
                <button
                  key={board.id}
                  onClick={() => toggleBoardType(board.id)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    surferPreferences.boardTypes.includes(board.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-200'
                  }`}
                >
                  <h5 className="font-medium text-gray-900">{board.label}</h5>
                  <p className="text-sm text-gray-600 mt-1">{board.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Surfing Style Description */}
          <div className="space-y-4">
            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">Describe Your Surfing Style and Experience</h4>
              <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 mb-4">
                <p className="mb-2"><strong>Why we ask this:</strong> Your description helps our AI understand:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>What wave conditions match your abilities</li>
                  <li>When a spot will be suitable for your level</li>
                  <li>Which breaks will be most enjoyable for you</li>
                  <li>How to tailor surf tips to your progression</li>
                </ul>
              </div>
            </div>
            <textarea
              value={surferPreferences.description}
              onChange={(e) => setSurferPreferences(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Example: I've been surfing for about a year and can catch unbroken waves. I'm comfortable paddling out in head-high waves and working on my bottom turns. I prefer less crowded spots and morning sessions..."
              className="w-full p-3 sm:p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px] text-sm sm:text-base"
            />
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep('spot')}
              className="text-blue-500 hover:text-blue-600 text-sm sm:text-base"
            >
              ← Back
            </button>
            <button
              onClick={handleSurferTypeSubmit}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm sm:text-base"
              disabled={!surferPreferences.description || surferPreferences.boardTypes.length === 0}
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-secondary-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-secondary-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-secondary-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 mb-2">What's Next?</h4>
            <p className="text-sm text-blue-700 mb-3">
              After creating your account, you'll receive a verification email. Please check your inbox and verify your email to access all features.
            </p>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep('surferType')}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              ← Back
            </button>
            <button
              type="submit"
              className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50 disabled:opacity-50 transition-colors"
              disabled={loading}
            >
              {loading ? 'Signing up...' : 'Create Account'}
            </button>
          </div>
        </form>
      )}

      {step === 'verify' && (
        <div className="text-center space-y-6">
          <h3 className="text-xl sm:text-2xl font-semibold">Verify Your Email</h3>
          <p className="text-sm sm:text-base text-gray-600">
            We've sent a verification email to {email}. Please check your inbox and click the verification link.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-3 text-sm max-w-md mx-auto">
            <strong>Note:</strong> You will only receive surf forecast emails after verifying your email address.
          </div>
          <div className="flex flex-col gap-4">
            <button
              onClick={() => router.push('/dashboard-v2')}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              Go to Dashboard
            </button>
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