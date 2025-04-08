import { useState } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

  const spots = [
    { id: 'ob', name: 'Ocean Beach' },
    { id: 'linda-mar', name: 'Linda Mar' },
    { id: 'montara', name: 'Montara' },
    { id: 'pleasure-point', name: 'Pleasure Point' },
    { id: 'steamers', name: 'Steamer Lane' },
  ];

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
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Send verification email
      await sendEmailVerification(user);

      // Create initial user profile in Firestore
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

  return (
    <div className="w-full">
      {error && <p className="text-red-500 mb-4">{error}</p>}
      
      {step === 'spot' && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold mb-4">Choose Your Home Break</h3>
          <div className="grid grid-cols-2 gap-4">
            {spots.map((spot) => (
              <button
                key={spot.id}
                onClick={() => handleSpotSelect(spot.id)}
                className="p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                {spot.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'surferType' && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold mb-4">Describe Your Surfing Style</h3>
          <textarea
            value={surferType}
            onChange={(e) => setSurferType(e.target.value)}
            placeholder="Example: I'm a beginner who loves small, clean waves. I'm working on my pop-up and catching unbroken waves..."
            className="w-full p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
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
        <form onSubmit={handleSignUp} className="space-y-4">
          <h3 className="text-xl font-semibold mb-4">Create Your Account</h3>
          <div>
            <label htmlFor="email" className="block text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
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
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Signing up...' : 'Sign Up Free'}
            </button>
          </div>
        </form>
      )}

      {step === 'verify' && (
        <div className="space-y-4 text-center">
          <h3 className="text-xl font-semibold mb-4">Verify Your Email</h3>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-blue-800">
              We've sent a verification email to <span className="font-semibold">{email}</span>
            </p>
            <p className="text-sm text-blue-600 mt-2">
              Please check your inbox and click the verification link to complete your registration.
            </p>
          </div>
          <div className="mt-4">
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 