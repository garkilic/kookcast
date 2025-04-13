import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSurfSpots, SurfSpot } from '@/lib/surfSpots';

type Step = 'spot' | 'surferType' | 'credentials' | 'verify';

export default function MultiStepSignUp() {
  const [step, setStep] = useState<Step>('spot');
  const [selectedSpot, setSelectedSpot] = useState('');
  const [surferType, setSurferType] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [spots, setSpots] = useState<SurfSpot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllSpots, setShowAllSpots] = useState(false);
  const SPOTS_TO_SHOW = 4;

  useEffect(() => {
    const fetchSpots = async () => {
      const surfSpots = await getSurfSpots();
      setSpots(surfSpots);
    };
    fetchSpots();
  }, []);

  const handleSpotSelect = (spotId: string) => {
    setSelectedSpot(spotId);
    setStep('surferType');
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

      await sendEmailVerification(user);

      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        createdAt: new Date().toISOString(),
        surfLocation: selectedSpot,
        surferType,
        emailVerified: false,
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
      
      {step === 'spot' && (
        <div className="space-y-6">
          <h3 className="text-2xl font-semibold mb-4">Choose Your Home Break</h3>
          
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

          {/* Surf Spots Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedSpots.map((spot) => (
              <button
                key={spot.id}
                onClick={() => handleSpotSelect(spot.id)}
                className={`p-4 border rounded-lg transition-all duration-200 ${
                  spot.isMostPopular 
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
            ))}
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

      {step === 'verify' && (
        <div className="text-center space-y-6">
          <h3 className="text-2xl font-semibold">Verify Your Email</h3>
          <p className="text-gray-600">
            We've sent a verification email to {email}. Please check your inbox and click the verification link.
          </p>
          <button
            onClick={() => setStep('credentials')}
            className="text-blue-500 hover:text-blue-600"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
} 