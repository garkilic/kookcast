import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSurfSpots, SurfSpot } from '@/lib/surfSpots';
import { useRouter } from 'next/navigation';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

// Add development mode flag
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

type Step = 'spot' | 'surferType' | 'credentials' | 'payment' | 'verify';

interface MultiStepSignUpPaidProps {
  onSwitchToFree: (firstSpot: string) => void;
}

// Payment form component
const PaymentForm = ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => {
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
      // In development mode, simulate successful payment
      if (IS_DEVELOPMENT) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        onSuccess();
        return;
      }

      // In production, process actual payment
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement)!,
      });

      if (stripeError) {
        setError(stripeError.message || 'Payment failed');
        return;
      }

      // Here you would typically send the paymentMethod.id to your backend
      // to create a subscription or process the payment
      console.log('Payment method created:', paymentMethod.id);
      
      onSuccess();
    } catch (err) {
      setError('An unexpected error occurred');
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

export default function MultiStepSignUpPaid({ onSwitchToFree }: MultiStepSignUpPaidProps) {
  const [step, setStep] = useState<Step>('spot');
  const [selectedSpots, setSelectedSpots] = useState<string[]>([]);
  const [surferType, setSurferType] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!IS_DEVELOPMENT) {
        await sendEmailVerification(user);
      }

      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        createdAt: new Date().toISOString(),
        surfLocations: selectedSpots,
        surferType,
        emailVerified: IS_DEVELOPMENT,
        isPremium: true,
      });

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
        <div className="space-y-6">
          <h3 className="text-2xl font-semibold mb-4">Describe Your Surfing Style</h3>
          <textarea
            value={surferType}
            onChange={(e) => setSurferType(e.target.value)}
            placeholder="Example: I'm a beginner who loves small, clean waves. I'm working on my pop-up and catching unbroken waves..."
            className="w-full p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px]"
          />
          <div className="flex justify-between">
            <button
              onClick={() => setStep('spot')}
              className="text-blue-500 hover:text-blue-600"
            >
              ← Back
            </button>
            <button
              onClick={handleSurferTypeSubmit}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              disabled={!surferType.trim()}
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
          {IS_DEVELOPMENT && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <p className="text-yellow-700">
                Development Mode: Payment processing is bypassed. Click "Complete Subscription" to continue.
              </p>
            </div>
          )}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="mb-6">
              <h4 className="text-lg font-medium mb-2">Kook+ Plan</h4>
              <p className="text-gray-600">$5/month</p>
              <div className="mt-4">
                <h5 className="font-medium mb-2">Selected Spots:</h5>
                <ul className="list-disc list-inside text-gray-600">
                  {selectedSpots.map(spotId => {
                    const spot = spots.find(s => s.id === spotId);
                    return spot ? <li key={spotId}>{spot.name}</li> : null;
                  })}
                </ul>
              </div>
            </div>

            {!IS_DEVELOPMENT && (
              <Elements stripe={stripePromise}>
                <PaymentForm
                  onSuccess={() => {
                    setStep('verify');
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
            )}

            {IS_DEVELOPMENT && (
              <div className="mt-6">
                <button
                  onClick={() => setStep('verify')}
                  className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600"
                >
                  Complete Subscription
                </button>
              </div>
            )}
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
          ) : IS_DEVELOPMENT ? (
            <p className="text-gray-600">
              Development Mode: Email verification is bypassed. You can proceed to the dashboard.
            </p>
          ) : (
            <p className="text-gray-600">
              We've sent a verification email to {email}. Please check your inbox and click the verification link.
            </p>
          )}
          <div className="flex flex-col gap-4">
            {IS_DEVELOPMENT && (
              <button
                onClick={() => {
                  router.push('/dashboard-v2');
                }}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              >
                Go to Dashboard
              </button>
            )}
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