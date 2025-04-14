import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { getSurfSpots, SurfSpot } from '@/lib/surfSpots';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from '@/components/CheckoutForm';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type Step = 'spots' | 'payment';

interface UpgradeToPremiumProps {
  onClose: () => void;
  currentSpots: string[];
}

export default function UpgradeToPremium({ onClose, currentSpots }: UpgradeToPremiumProps) {
  const [step, setStep] = useState<Step>('spots');
  const [selectedSpots, setSelectedSpots] = useState<string[]>(currentSpots);
  const [spots, setSpots] = useState<SurfSpot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllSpots, setShowAllSpots] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
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
    if (selectedSpots.includes(spotId)) {
      setSelectedSpots(selectedSpots.filter(id => id !== spotId));
    } else {
      setSelectedSpots([...selectedSpots, spotId]);
    }
  };

  const handleContinueToPayment = async () => {
    try {
      const response = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spots: selectedSpots,
        }),
      });

      const { clientSecret } = await response.json();
      setClientSecret(clientSecret);
      setStep('payment');
    } catch (error) {
      console.error('Error creating subscription:', error);
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      await updateDoc(doc(db, 'users', user.uid), {
        isPremium: true,
        surfLocations: selectedSpots,
      });

      router.refresh();
      onClose();
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const filteredSpots = spots.filter(spot => 
    spot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    spot.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedSpots = showAllSpots ? filteredSpots : filteredSpots.slice(0, SPOTS_TO_SHOW);
  const hasMoreSpots = filteredSpots.length > SPOTS_TO_SHOW;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold">Upgrade to Kook+</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {step === 'spots' && (
            <div className="space-y-6">
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-800 mb-2">Select Your Surf Spots</h3>
                <p className="text-purple-700 text-sm">
                  Choose the spots you want to track. You can change these later.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search surf spots..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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

              {/* Surf Spots Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedSpots.map((spot) => {
                  const isSelected = selectedSpots.includes(spot.id);
                  
                  return (
                    <button
                      key={spot.id}
                      onClick={() => handleSpotSelect(spot.id)}
                      className={`p-4 border rounded-lg transition-all duration-200 relative ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50'
                          : spot.isMostPopular 
                            ? 'border-2 border-purple-500 bg-purple-50 hover:border-purple-600 hover:bg-purple-100' 
                            : 'hover:border-purple-500 hover:bg-purple-50'
                      }`}
                    >
                      {spot.isMostPopular && (
                        <div className="absolute -top-2 left-2 bg-purple-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                          Popular
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <div className="font-medium text-lg">{spot.name}</div>
                        <div className="text-sm text-gray-600">{spot.region}</div>
                        <div className="text-sm text-gray-500 line-clamp-2">{spot.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {hasMoreSpots && !showAllSpots && (
                <button
                  onClick={() => setShowAllSpots(true)}
                  className="w-full py-3 text-purple-500 hover:text-purple-600 font-medium"
                >
                  Show {filteredSpots.length - SPOTS_TO_SHOW} more spots
                </button>
              )}

              {filteredSpots.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No surf spots found matching your search.
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleContinueToPayment}
                  disabled={selectedSpots.length === 0}
                  className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {step === 'payment' && clientSecret && (
            <div className="space-y-6">
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-800 mb-2">Complete Your Subscription</h3>
                <p className="text-purple-700 text-sm">
                  Enter your payment details to upgrade to Kook+
                </p>
              </div>

              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm 
                  onSuccess={handlePaymentSuccess} 
                  clientSecret={clientSecret}
                />
              </Elements>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 