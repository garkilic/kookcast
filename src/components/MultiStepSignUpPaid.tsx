import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSurfSpots, SurfSpot } from '@/lib/surfSpots';
import { useRouter } from 'next/navigation';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { loadStripe } from '@stripe/stripe-js';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc as firestoreDoc, addDoc, onSnapshot } from 'firebase/firestore';

const stripePromise = loadStripe('pk_test_51REGmDCKpNGLkmsGVt0NT8thUxrD9MKt11KqoSJzuZNUgz1lcE7lxye6vV37my8yV36JA6SmDBLmwXZaSik5fhNc00Nb10iqES');

type Step = 'spot' | 'credentials' | 'payment' | 'verify' | 'surferType';

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

const PaymentForm = ({ onSuccess, onCancel }: { 
  onSuccess: () => void; 
  onCancel: () => void;
}) => {
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
        cancel_url: window.location.origin + '/dashboard-v2',
        mode: 'subscription',
        redirect_mode: 'redirect'
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Kook+ Membership</h3>
            <span className="text-2xl font-bold text-blue-600">$5<span className="text-sm font-normal text-gray-500">/month</span></span>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="ml-3 text-gray-600">Track multiple surf spots</span>
            </div>
            <div className="flex items-start">
              <svg className="h-5 w-5 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="ml-3 text-gray-600">Personalized surf recommendations</span>
            </div>
            <div className="flex items-start">
              <svg className="h-5 w-5 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="ml-3 text-gray-600">Advanced surf forecasting</span>
            </div>
            <div className="flex items-start">
              <svg className="h-5 w-5 text-green-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="ml-3 text-gray-600">Cross-spot condition analysis</span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Your membership will be activated immediately after payment. You can cancel anytime.
            </p>
          </div>
        </div>
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
          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
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
      try {
        console.log('Fetching surf spots...');
      const surfSpots = await getSurfSpots();
        console.log('Fetched spots:', surfSpots);
      setSpots(surfSpots);
      } catch (error) {
        console.error('Error fetching spots:', error);
        setError('Failed to load surf spots. Please try again.');
      }
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
      setStep('surferType');
    } else if (step === 'surferType') {
      setStep('credentials');
    } else if (step === 'credentials') {
      setStep('payment');
    } else if (step === 'payment') {
      setStep('verify');
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

      // Create user document in Firestore (premium will be set after payment)
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        premium: false,
        surfLocations: selectedSpots,
        surferPreferences,
        createdAt: new Date().toISOString(),
      });

      // Move to payment step (do not send verification yet)
      setStep('payment');
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

  console.log('Filtered spots:', filteredSpots);
  console.log('Search query:', searchQuery);
  console.log('Total spots:', spots.length);

  const displayedSpots = showAllSpots ? filteredSpots : filteredSpots.slice(0, SPOTS_TO_SHOW);
  const hasMoreSpots = filteredSpots.length > SPOTS_TO_SHOW;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {error && <p className="text-red-500 mb-4">{error}</p>}
      
      {step === 'spot' && (
        <div className="space-y-6">
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
          <div>
            <h3 className="text-2xl font-semibold mb-2 text-center">Tell Us About Your Surfing</h3>
            <p className="text-gray-600 text-center mb-6">
              As a Kook+ member, our AI uses your surfing style and experience to provide personalized recommendations across all your selected spots. The more you tell us, the better we can match conditions to your abilities and preferences.
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
        <form onSubmit={handleSignUp} className="space-y-8 bg-white p-8 rounded-xl shadow-md border border-gray-100 max-w-lg mx-auto">
          <div className="mb-4 text-center">
            <h3 className="text-2xl font-bold mb-1">Create Your Account</h3>
            <p className="text-gray-500 text-base">Start your surf journey with KookCast</p>
          </div>
          <div className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12H8m8 0a4 4 0 11-8 0 4 4 0 018 0zm0 0v1a4 4 0 01-8 0v-1" /></svg>
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.104 0 2-.896 2-2s-.896-2-2-2-2 .896-2 2 .896 2 2 2zm6 2v-2a6 6 0 10-12 0v2a2 2 0 00-2 2v4a2 2 0 002 2h12a2 2 0 002-2v-4a2 2 0 00-2-2z" /></svg>
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                required
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-400 mt-1 ml-1">Minimum 6 characters</p>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.104 0 2-.896 2-2s-.896-2-2-2-2 .896-2 2 .896 2 2 2zm6 2v-2a6 6 0 10-12 0v2a2 2 0 00-2 2v4a2 2 0 002 2h12a2 2 0 002-2v-4a2 2 0 00-2-2z" /></svg>
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                required
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <span className="text-xs text-gray-400 text-center">We'll never share your email.</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => setStep('surferType')}
              className="text-blue-500 hover:text-blue-600 text-sm font-medium"
            >
              ← Back
            </button>
            <button
              type="submit"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 transition-colors text-base font-semibold min-w-[120px]"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center"><svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>Signing up...</span>
              ) : 'Sign Up'}
            </button>
          </div>
        </form>
      )}

      {step === 'payment' && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Payment Information</h2>
          <PaymentForm
            onSuccess={async () => {
              try {
                const authInstance = getAuth();
                const dbInstance = getFirestore();
                const user = authInstance.currentUser;
                if (!user) throw new Error('User not logged in');
                // Set premium true in Firestore
                await setDoc(
                  doc(dbInstance, 'users', user.uid),
                  { premium: true },
                  { merge: true }
                );
                // Send email verification
                await sendEmailVerification(user);
                setVerificationSent(true);
                setStep('verify');
              } catch (err: any) {
                setError(err.message || 'Error during post-payment process');
              }
            }}
            onCancel={() => setPaymentCancelled(true)}
          />
        </div>
      )}

      {step === 'verify' && (
        <div className="text-center space-y-6">
          <h3 className="text-2xl font-semibold">Verify Your Email</h3>
          {paymentCancelled ? (
            <div className="bg-yellow-50 p-4 rounded-lg mb-4">
              <p className="text-yellow-700">
                You've selected the free plan. You'll receive forecasts for {selectedSpots[0]} only.
              </p>
            </div>
          ) : (
            <p className="text-gray-600">
              We've sent a verification email to {email}. Please check your inbox and click the verification link.
            </p>
          )}
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
              className="text-blue-500 hover:text-blue-600"
            >
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 