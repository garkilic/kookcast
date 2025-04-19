import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSurfSpots, SurfSpot } from '@/lib/surfSpots';
import { useRouter } from 'next/navigation';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Initialize Stripe
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

// Payment form component
const PaymentForm = ({ onSuccess, onCancel, userEmail, userId }: { 
  onSuccess: (paymentId: string) => void; 
  onCancel: () => void;
  userEmail?: string;
  userId?: string;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    try {
      // Always process actual payment
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement)!,
      });

      if (stripeError) {
        setError(stripeError.message || 'Payment failed');
        setProcessing(false);
        return;
      }

      // Send the paymentMethod.id to your backend to create a subscription or payment intent
      const response = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          paymentMethodId: paymentMethod.id,
          email: userEmail,
          userId: userId
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Payment failed');
        setProcessing(false);
        return;
      }

      // If the backend returns a clientSecret for further action (e.g., 3D Secure)
      if (result.clientSecret && result.requiresAction) {
        const confirmResult = await stripe.confirmCardPayment(result.clientSecret);
        if (confirmResult.error) {
          setError(confirmResult.error.message || 'Payment confirmation failed');
          setProcessing(false);
          return;
        }
        if (confirmResult.paymentIntent && confirmResult.paymentIntent.status === 'succeeded') {
          onSuccess(confirmResult.paymentIntent.id);
          setProcessing(false);
          return;
        }
      } else if (result.success) {
        // Payment succeeded without further action
        onSuccess(result.paymentIntentId);
        setProcessing(false);
        return;
      } else {
        setError('Payment processing failed');
        setProcessing(false);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      console.error('Payment error:', err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
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
          disabled={!stripe || processing}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {processing ? 'Processing...' : 'Pay Now'}
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
      setStep('credentials');
    } else if (step === 'credentials') {
      setStep('payment');
    } else if (step === 'payment') {
      setStep('surferType');
    } else if (step === 'surferType') {
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
      if (!email) {
        setError('Email is required');
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await sendEmailVerification(user);

      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        createdAt: new Date().toISOString(),
        surfLocations: selectedSpots,
        surferDescription: surferPreferences.description,
        boardTypes: surferPreferences.boardTypes,
        emailVerified: false,
        isPremium: true,
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
        <form onSubmit={handleSignUp} className="space-y-6">
          <h3 className="text-2xl font-semibold mb-4">Create Your Account</h3>
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
              type="submit"
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600"
              disabled={loading}
            >
              {loading ? 'Signing up...' : 'Sign Up'}
            </button>
          </div>
        </form>
      )}

      {step === 'payment' && (
        <div className="space-y-6">
          <h3 className="text-2xl font-semibold mb-4">Complete Your Kook+ Subscription</h3>
          
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-100 mb-6">
            <h4 className="text-xl font-medium text-blue-800 mb-4">Kook+ Premium Benefits</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <div className="text-blue-500 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h5 className="font-medium text-gray-900">Multiple Spots Tracking</h5>
                  <p className="text-sm text-gray-600">Monitor all your favorite surf spots in one place</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="text-blue-500 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h5 className="font-medium text-gray-900">Priority Notifications</h5>
                  <p className="text-sm text-gray-600">Get alerts when conditions are perfect for you</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="text-blue-500 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h5 className="font-medium text-gray-900">Advanced Forecasting</h5>
                  <p className="text-sm text-gray-600">Access to detailed swell, wind, and tide predictions</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="text-blue-500 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h5 className="font-medium text-gray-900">Personalized Recommendations</h5>
                  <p className="text-sm text-gray-600">AI-powered surf suggestions based on your style</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="text-blue-500 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h5 className="font-medium text-gray-900">Exclusive Content</h5>
                  <p className="text-sm text-gray-600">Access to premium tips, guides and tutorials</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="text-blue-500 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h5 className="font-medium text-gray-900">Ad-Free Experience</h5>
                  <p className="text-sm text-gray-600">Enjoy clean, distraction-free forecasts</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-white rounded-lg border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-sm text-gray-500">Your subscription</span>
                  <span className="text-2xl font-bold text-gray-900">$5</span>
                  <span className="text-gray-500 text-sm">/month</span>
                </div>
                <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  Cancel anytime
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="mb-6">
              <h4 className="text-lg font-medium mb-2">Your Selected Spots</h4>
              <div className="mt-4">
                <ul className="space-y-2">
                  {selectedSpots.map(spotId => {
                    const spot = spots.find(s => s.id === spotId);
                    return spot ? (
                      <li key={spotId} className="flex items-center bg-blue-50 p-2 rounded-lg">
                        <span className="text-blue-600 mr-2">•</span>
                        <span>{spot.name}</span> 
                        <span className="text-xs text-gray-500 ml-2">({spot.region})</span>
                      </li>
                    ) : null;
                  })}
                </ul>
              </div>
            </div>

            <Elements stripe={stripePromise}>
              <PaymentForm
                userEmail={email}
                userId={auth.currentUser?.uid}
                onSuccess={(paymentId) => {
                  // If we have a user and payment ID, save it to Firestore
                  if (auth.currentUser && paymentId) {
                    setDoc(doc(db, 'users', auth.currentUser.uid), {
                      stripePaymentId: paymentId,
                      isPremium: true,
                      premiumStartDate: new Date().toISOString()
                    }, { merge: true });
                  }
                  // Redirect to dashboard after successful payment
                  router.push('/dashboard-v2');
                }}
                onCancel={() => {
                  setPaymentCancelled(true);
                  if (auth.currentUser) {
                    // Keep only the first selected spot for free users
                    const firstSpot = selectedSpots[0];
                    setDoc(doc(db, 'users', auth.currentUser.uid), {
                      isPremium: false,
                      surfLocations: [firstSpot],
                    }, { merge: true });
                  }
                  setStep('verify');
                }}
              />
            </Elements>
          </div>
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