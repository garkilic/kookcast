import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, setDoc, onSnapshot, DocumentData, collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSurfSpots, SurfSpot } from '@/lib/surfSpots';
import { useRouter } from 'next/navigation';
import { getFunctions, httpsCallable } from 'firebase/functions';

type Step = 'spot' | 'surferType' | 'credentials' | 'verify' | 'payment';

interface SurferPreferences {
  description: string;
  boardTypes: string[];
}

interface MultiStepSignUpPaidProps {
  onUpgradeToPremium: () => void;
  onSwitchToFree: (firstSpot: string) => void;
  initialSpot?: string | null;
  initialEmail?: string;
}

interface PortalSessionResponse {
  url: string;
}

// Add development mode flag
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Payment form component
const PaymentForm = ({ onSuccess, onCancel, email, password }: { 
  onSuccess: () => void; 
  onCancel: () => void;
  email: string;
  password: string;
}) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setProcessing(true);
    setError('');

    try {
      console.log('Starting payment process...');
      
      // Create user with email and password
      console.log('Creating user account...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('User account created:', user.uid);

      // Create user document in Firestore
      console.log('Creating user document in Firestore...');
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        email: user.email,
        createdAt: new Date().toISOString(),
        isPremium: false, // Will be updated after payment
        emailVerified: IS_DEVELOPMENT, // Set to true in development
      });
      console.log('User document created in Firestore');

      // Create a customer portal session
      console.log('Creating customer portal session...');
      const response = await fetch('/api/createPortalSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          returnUrl: window.location.origin,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create portal session');
      }

      const { url } = await response.json();
      
      // Redirect to the portal URL
      if (url) {
        console.log('Redirecting to Stripe Customer Portal...');
        window.location.href = url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (err: any) {
      console.error('Error in payment process:', err);
      if (err.message.includes('collection')) {
        setError('Payment system is not properly configured. Please try again later.');
      } else {
        setError(err.message || 'An error occurred during payment processing');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    // Clear any pending premium user data
    localStorage.removeItem('pendingPremiumUser');
    // Call the onCancel callback
    onCancel();
    // Redirect to the cancel page
    router.push('/payment/cancel');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {IS_DEVELOPMENT && (
        <div className="bg-yellow-50 p-4 rounded-lg mb-6">
          <h4 className="text-lg font-semibold text-yellow-800 mb-2">Test Mode</h4>
          <p className="text-yellow-700 mb-2">
            You're in test mode. Use these test card numbers:
          </p>
          <ul className="list-disc list-inside text-yellow-700 space-y-1">
            <li>Success: 4242 4242 4242 4242</li>
            <li>Decline: 4000 0000 0000 0002</li>
          </ul>
          <p className="text-yellow-700 mt-2">
            Use any future expiration date, any 3-digit CVC, and any postal code.
          </p>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Kook+ Premium Subscription</h3>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-gray-600">Monthly subscription</p>
              <p className="text-2xl font-bold text-gray-900">$9.99/month</p>
            </div>
            <div className="bg-blue-50 p-2 rounded-full">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-green-500 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-medium text-gray-900">Multiple Surf Spots</p>
              <p className="text-sm text-gray-600">Access forecasts for all your favorite spots</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-green-500 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-medium text-gray-900">Advanced Wave Analysis</p>
              <p className="text-sm text-gray-600">Detailed wave conditions and forecasts</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-green-500 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-medium text-gray-900">Personalized Recommendations</p>
              <p className="text-sm text-gray-600">Get spot recommendations based on your preferences</p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-600">Total</p>
            <p className="text-xl font-bold text-gray-900">$9.99/month</p>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Cancel anytime. Your subscription will automatically renew each month.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleCancel}
          className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={processing}
          className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
        >
          {processing ? 'Processing...' : 'Continue to Payment'}
        </button>
      </div>
    </form>
  );
};

export default function MultiStepSignUpPaid({ 
  onUpgradeToPremium, 
  onSwitchToFree, 
  initialSpot, 
  initialEmail 
}: MultiStepSignUpPaidProps) {
  const [step, setStep] = useState<Step>('spot');
  const [selectedSpots, setSelectedSpots] = useState<string[]>(initialSpot ? [initialSpot] : []);
  const [surferPreferences, setSurferPreferences] = useState<SurferPreferences>({
    description: '',
    boardTypes: []
  });
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [spots, setSpots] = useState<SurfSpot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllSpots, setShowAllSpots] = useState(false);
  const [paymentCancelled, setPaymentCancelled] = useState(false);
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
    setSelectedSpots(prev => {
      if (prev.includes(spotId)) {
        return prev.filter(id => id !== spotId);
      } else {
        return [...prev, spotId];
      }
    });
  };

  const handleSurferTypeSubmit = () => {
    setStep('credentials');
  };

  const handleNext = async () => {
    if (step === 'spot') {
      if (selectedSpots.length === 0) {
        setError('Please select at least one spot');
        return;
      }
      setStep('surferType');
    } else if (step === 'surferType') {
      if (!surferPreferences.description || surferPreferences.boardTypes.length === 0) {
        setError('Please complete your surfer profile');
        return;
      }
      setStep('credentials');
    } else if (step === 'credentials') {
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
      setStep('verify');
    } else if (step === 'verify') {
      setStep('payment');
    }
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
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!IS_DEVELOPMENT) {
      await sendEmailVerification(user);
      }

      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        selectedSpots,
        surferPreferences,
        createdAt: new Date().toISOString(),
        isPremium: false, // Will be updated after payment
        emailVerified: IS_DEVELOPMENT, // Set to true in development
      });

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

  return (
    <div className="w-full max-w-4xl mx-auto">
      {error && <p className="text-red-500 mb-4">{error}</p>}
      
      {/* Add a progress indicator */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <div className="h-2 bg-gray-200 rounded-full">
              <div 
                className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                style={{ 
                  width: step === 'spot' ? '20%' : 
                         step === 'surferType' ? '40%' : 
                         step === 'credentials' ? '60%' : 
                         step === 'verify' ? '80%' : '100%' 
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-600">
          <span>Choose Spots</span>
          <span>Surfer Type</span>
          <span>Account</span>
          <span>Verify</span>
          <span>Payment</span>
        </div>
      </div>
      
      {step === 'spot' && (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Kook+ Premium Sign Up</h3>
            <p className="text-blue-700">
              You're signing up for Kook+ Premium, which includes access to multiple surf spots and advanced features.
              The subscription is $9.99/month and can be cancelled anytime.
            </p>
          </div>
          
          <h3 className="text-2xl font-semibold mb-4">Choose Your Surf Spots</h3>
          <p className="text-gray-600 mb-4">
            As a Kook+ member, you can select multiple surf spots to receive forecasts for.
          </p>
          
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search surf spots..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Selected Spots Display */}
          {selectedSpots.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h4 className="font-medium mb-2">Selected Spots ({selectedSpots.length})</h4>
              <div className="flex flex-wrap gap-2">
                {selectedSpots.map(spotId => {
                  const spot = spots.find(s => s.id === spotId);
                  return spot ? (
                    <span key={spotId} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                      {spot.name}
                      <button
                        onClick={() => handleSpotSelect(spotId)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        ✕
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Surf Spots Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedSpots.map((spot) => {
              const isSelected = selectedSpots.includes(spot.id);
              
              return (
                <button
                  key={spot.id}
                  onClick={() => handleSpotSelect(spot.id)}
                  className={`p-4 border rounded-lg transition-all duration-200 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : spot.isMostPopular 
                        ? 'border-yellow-400 bg-yellow-50 hover:border-yellow-500 hover:bg-yellow-100' 
                        : 'hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {spot.isMostPopular && (
                      <span className="text-yellow-500 text-xl">⭐</span>
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-lg">{spot.name}</div>
                      <div className="text-sm text-gray-600 mt-1">{spot.region}</div>
                      <div className="text-sm text-gray-500 mt-2 line-clamp-2">{spot.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {hasMoreSpots && !showAllSpots && (
            <button
              onClick={() => setShowAllSpots(true)}
              className="w-full py-3 text-blue-500 hover:text-blue-600 font-medium"
            >
              Show {filteredSpots.length - SPOTS_TO_SHOW} more spots
            </button>
          )}

          {filteredSpots.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No surf spots found matching your search.
            </div>
          )}

          {selectedSpots.length > 0 && (
            <div className="sticky bottom-0 bg-white pt-4 mt-4 border-t border-gray-200">
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setStep('surferType')}
                  className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600"
                >
                  Continue with {selectedSpots.length} {selectedSpots.length === 1 ? 'spot' : 'spots'}
                </button>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">Want to switch to Free?</h4>
                      <p className="text-sm text-gray-600">You'll keep your first selected spot</p>
                    </div>
                    <button
                      onClick={() => {
                        // Keep only the first selected spot
                        const firstSpot = selectedSpots[0];
                        setSelectedSpots([firstSpot]);
                        // Switch to free signup
                        localStorage.removeItem('signupType');
                        onSwitchToFree(firstSpot);
                      }}
                      className="w-full sm:w-auto px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      Switch to Free
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
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Tell Us About Your Surfing</h3>
            <p className="text-blue-700">
              Help us personalize your experience. After this, you'll create your account and set up payment.
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
                  <li>What wave conditions match your abilities across different spots</li>
                  <li>When each of your selected spots will be suitable for your level</li>
                  <li>Which breaks will be most enjoyable for you</li>
                  <li>How to tailor surf tips to your progression</li>
                  <li>Cross-spot recommendations based on your preferences</li>
                </ul>
              </div>
            </div>
            <textarea
              value={surferPreferences.description}
              onChange={(e) => setSurferPreferences(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Example: I've been surfing for about a year and can catch unbroken waves. I'm comfortable paddling out in head-high waves and working on my bottom turns. I prefer less crowded spots and morning sessions..."
              className="w-full p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px]"
            />
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep('spot')}
              className="text-blue-500 hover:text-blue-600"
            >
              ← Back
            </button>
            <button
              onClick={handleSurferTypeSubmit}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              disabled={!surferPreferences.description || surferPreferences.boardTypes.length === 0}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 'credentials' && (
        <form onSubmit={handleSignUp} className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Create Your Account</h3>
            <p className="text-blue-700">
              Set up your account details. After this step, you'll be asked to set up your payment method for the Kook+ Premium subscription.
            </p>
          </div>

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
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep('surferType')}
              className="text-blue-500 hover:text-blue-600"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600"
            >
              Continue to Payment
            </button>
          </div>
        </form>
      )}

      {step === 'verify' && (
        <div className="text-center space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Verify Your Email</h3>
            {IS_DEVELOPMENT ? (
              <p className="text-blue-700">
                Development Mode: Email verification is bypassed. You can proceed to payment.
              </p>
          ) : (
              <p className="text-blue-700">
              We've sent a verification email to {email}. Please check your inbox and click the verification link.
                After verifying your email, you'll be able to proceed with the payment.
            </p>
          )}
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={() => setStep('credentials')}
              className="text-blue-500 hover:text-blue-600"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep('payment')}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              {IS_DEVELOPMENT ? 'Continue to Payment' : 'I have verified my email'}
            </button>
          </div>
        </div>
      )}

      {step === 'payment' && (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Set Up Your Payment</h3>
            <p className="text-blue-700">
              Your account is verified! Now, let's set up your payment method for the Kook+ Premium subscription.
            </p>
          </div>
          
          <PaymentForm
            onSuccess={() => router.push('/dashboard-v2')}
            onCancel={() => setPaymentCancelled(true)}
            email={email}
            password={password}
          />
        </div>
      )}
    </div>
  );
} 