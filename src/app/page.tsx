"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import Image from "next/image";
import Modal from '@/components/Modal';
import SignUpForm from '@/components/SignUpForm';
import MultiStepSignUp from '@/components/MultiStepSignUp';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

type Spot = {
  id: string;
  name: string;
  region: string;
  isPopular: boolean;
  description: string;
};

export default function Home() {
  const [showModal, setShowModal] = useState(false);
  const [showPrefsModal, setShowPrefsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [surfPreference, setSurfPreference] = useState('');
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [email, setEmail] = useState(''); // For sign-up
  const [signInEmail, setSignInEmail] = useState(''); // For sign-in modal
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  const spots = [
    { 
      id: 'ob', 
      name: "Ocean Beach - Kelly's Cove", 
      region: 'San Francisco',
      isPopular: true,
      description: 'Popular spot with consistent waves'
    },
    { 
      id: 'linda-mar', 
      name: 'Linda Mar - South Peak', 
      region: 'Pacifica',
      isPopular: true,
      description: 'Great beginner spot with regular waves'
    },
    { 
      id: 'montara', 
      name: 'Montara State Beach', 
      region: 'Half Moon Bay',
      isPopular: false,
      description: 'Less crowded with good morning conditions'
    },
    { 
      id: 'pleasure-point', 
      name: 'Pleasure Point', 
      region: 'Santa Cruz',
      isPopular: true,
      description: 'Iconic spot with reliable waves'
    },
    { 
      id: 'steamers', 
      name: 'Steamer Lane', 
      region: 'Santa Cruz',
      isPopular: true,
      description: 'World-famous right point break'
    },
    { 
      id: 'fort-point', 
      name: 'Fort Point', 
      region: 'San Francisco',
      isPopular: true,
      description: 'Historic spot under the Golden Gate'
    },
    { 
      id: 'rockaway', 
      name: 'Rockaway Beach', 
      region: 'Pacifica',
      isPopular: false,
      description: 'Consistent beach break'
    },
    { 
      id: 'princeton', 
      name: 'Princeton Jetty', 
      region: 'Half Moon Bay',
      isPopular: false,
      description: 'Popular spot near the harbor'
    },
  ];

  const filteredSpots = spots.filter(spot => 
    spot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    spot.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Add effect to prevent scrolling when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
    });

    return () => unsubscribe();
  }, []);

  const handleSpotSelection = (spot: Spot) => {
    if (showConfirmation && spot.id === selectedSpot?.id) {
      // If clicking the selected spot again, unselect it
      setSelectedSpot(null);
      setShowConfirmation(false);
    } else {
      setSelectedSpot(spot);
      setShowConfirmation(true);
    }
  };

  const handleSpotConfirmation = () => {
    setShowModal(false);
    setShowPrefsModal(true);
  };

  const handleSpotCancel = () => {
    setSelectedSpot(null);
    setShowConfirmation(false);
  };

  const handlePreferenceSubmit = () => {
    console.log('Selected spot:', selectedSpot);
    console.log('Surf preference:', surfPreference);
    setShowPrefsModal(false);
    // Here you would typically handle the signup with the collected data
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    localStorage.removeItem('signupType');
    setIsSignUpModalOpen(true);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(
        auth,
        signInEmail.trim(),
        password
      );

      if (!userCredential.user) {
        throw new Error('Authentication failed');
      }

      // Close the modal and clear form
      setIsSignInModalOpen(false);
      setSignInEmail('');
      setPassword('');
      
      // Use Next.js router for navigation to dashboard-v2
      router.push('/dashboard-v2');
    } catch (error: any) {
      console.error('Sign in error:', error);
      // Handle specific Firebase error codes
      if (error.code === 'auth/invalid-credential' || 
          error.code === 'auth/wrong-password' || 
          error.code === 'auth/user-not-found') {
        setError('Invalid email or password');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email format');
      } else {
        setError(error.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-4 py-4 sm:py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => router.push('/')}
            className="text-2xl sm:text-3xl font-bold text-primary-600 hover:text-primary-700 transition-colors"
          >
            KookCast
          </button>
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <button 
                onClick={() => router.push('/dashboard-v2')}
                className="text-sm sm:text-base text-secondary-600 hover:text-primary-600"
              >
                Account
              </button>
            ) : (
              <button 
                onClick={() => setIsSignInModalOpen(true)}
                className="text-sm sm:text-base text-secondary-600 hover:text-primary-600"
              >
                Sign In
              </button>
            )}
            <button 
              onClick={() => {
                const featuresSection = document.getElementById('features');
                if (featuresSection) {
                  featuresSection.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                  });
                }
              }} 
              className="text-sm sm:text-base text-secondary-600 hover:text-primary-600"
            >
              Features
            </button>
            <button 
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} 
              className="text-sm sm:text-base text-secondary-600 hover:text-primary-600"
            >
              Pricing
            </button>
            <button 
              onClick={() => router.push('/about')}
              className="text-sm sm:text-base text-secondary-600 hover:text-primary-600"
            >
              About
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section className="px-4 pt-8 sm:pt-12 pb-12 sm:pb-16 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-2 sm:mb-4 inline-flex items-center px-3 sm:px-4 py-1.5 rounded-full bg-secondary-100 text-secondary-700 text-sm font-medium">
              Version 0.5
            </div>
            <div className="mb-6 sm:mb-8 inline-flex items-center px-3 sm:px-4 py-1.5 rounded-full bg-primary-50 text-primary-700 text-sm font-medium">
              <span className="mr-2">🤖</span>
              AI-Powered Personal Surf Coach
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-secondary-900">
              Your Daily Surf Email,<br />
              <span className="text-primary-600">Tailored to Your Skill Level</span>
            </h1>
            <p className="mt-4 sm:mt-6 text-lg sm:text-xl text-secondary-600 max-w-2xl mx-auto">
              Get a personalized surf forecast in your inbox every morning—no apps, no charts, just clear advice for your skill level.
            </p>
            <div className="mt-8 flex flex-col items-center gap-y-4">
              <div className="flex flex-col items-center gap-4 w-full max-w-md">
                <div className="bg-blue-50 p-4 rounded-lg w-full text-center">
                  <p className="text-sm text-blue-800">
                    We'll ask a few quick questions about your surfing experience to personalize your daily forecasts to your skill level.
                  </p>
                </div>
                <form onSubmit={handleEmailSubmit} className="w-full flex flex-col sm:flex-row gap-4">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-lg border border-secondary-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                  <button 
                    type="submit"
                    className="w-full sm:w-auto px-8 py-3 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors font-medium whitespace-nowrap"
                  >
                    Start Free
                  </button>
                </form>
              </div>
            </div>
            
            {/* Example Preview Card */}
            <div className="mt-12 sm:mt-16 relative">
              <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 max-w-2xl mx-auto transform hover:-translate-y-1 transition-transform duration-300">
                {/* Email Header */}
                <div className="flex items-center justify-between mb-6 border-b border-secondary-200 pb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-600 text-xl">🏄‍♂️</span>
                    </div>
                    <div className="ml-3">
                      <p className="font-semibold text-secondary-900">Ocean Beach Forecast</p>
                      <p className="text-sm text-secondary-500">5:00 AM</p>
                    </div>
                  </div>
                </div>

                {/* Surf Alert Box */}
                <div className="bg-green-50 border border-dashed border-green-200 rounded-lg p-6 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🎯</span>
                    <h3 className="text-xl font-semibold text-green-800">Perfect Match: Your Ideal Session Today</h3>
                  </div>
                  <p className="text-green-700 text-lg mb-2">Based on your intermediate skill level and preference for clean, shoulder-high waves</p>
                  <p className="text-green-700 text-lg">AI forecast predicts excellent conditions matching your surfing style</p>
                </div>

                {/* Email Body */}
                <div className="space-y-6">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary-50 p-3 rounded-lg text-center">
                      <p className="text-sm font-medium text-secondary-900">Wave Height</p>
                      <p className="text-sm text-secondary-600">4-5ft • Perfect for you</p>
                    </div>
                    <div className="bg-secondary-50 p-3 rounded-lg text-center">
                      <p className="text-sm font-medium text-secondary-900">Conditions</p>
                      <p className="text-sm text-secondary-600">✨ Clean & Glassy</p>
                    </div>
                    <div className="bg-secondary-50 p-3 rounded-lg text-center">
                      <p className="text-sm font-medium text-secondary-900">Skill Match</p>
                      <p className="text-sm text-secondary-600">98% Compatible</p>
                    </div>
                    <div className="bg-secondary-50 p-3 rounded-lg text-center">
                      <p className="text-sm font-medium text-secondary-900">Best Board</p>
                      <p className="text-sm text-secondary-600">7'2" Funboard</p>
                    </div>
                  </div>

                  {/* Session Times */}
                  <div className="bg-secondary-50 p-4 rounded-lg">
                    <h5 className="font-medium text-secondary-900 mb-3 text-center">Personalized Session Times</h5>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-secondary-200 pb-2">
                        <div className="flex items-center">
                          <span className="mr-2">🎯</span>
                          <span className="font-medium">Prime Session</span>
                        </div>
                        <span className="text-secondary-600">6:00-8:00am (Perfect for your level)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="mr-2">👌</span>
                          <span className="font-medium">Backup Session</span>
                        </div>
                        <span className="text-secondary-600">4:00-5:30pm (Good conditions)</span>
                      </div>
                    </div>
                  </div>

                  {/* AI Tips Section */}
                  <div className="bg-secondary-50 p-4 rounded-lg">
                    <h5 className="font-medium text-secondary-900 mb-3 text-center">AI Coaching Tips</h5>
                    <div className="space-y-2">
                      <p className="text-sm text-secondary-600 flex items-start">
                        <span className="mr-2">🎯</span>
                        <span>Perfect conditions to practice your bottom turns - waves have good wall sections</span>
                      </p>
                      <p className="text-sm text-secondary-600 flex items-start">
                        <span className="mr-2">💡</span>
                        <span>Based on your progress, try taking off closer to the peak today</span>
                      </p>
                      <p className="text-sm text-secondary-600 flex items-start">
                        <span className="mr-2">🌊</span>
                        <span>South peak aligns best with your preferred wave type</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Email Comparison Section */}
        <section id="features" className="px-4 py-12 bg-secondary-50">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-2xl sm:text-3xl font-bold text-center text-secondary-900 mb-8">AI-Powered Clarity, Not Confusion</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* Typical Forecast */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 rounded-full bg-secondary-100 flex items-center justify-center">
                    <span className="text-secondary-600 text-xl">📊</span>
                  </div>
                  <div className="ml-3">
                    <p className="font-semibold text-secondary-900">Traditional Surf Report</p>
                    <p className="text-sm text-secondary-500">Complex & Overwhelming</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-secondary-50 p-4 rounded-lg">
                    <p className="font-mono text-sm text-secondary-600">Primary Swell: 3.8ft @ 15s WNW (290°) | WVHT 4.2ft</p>
                    <p className="font-mono text-sm text-secondary-600">Secondary Swell: 2.1ft @ 8s SW (210°) | WVHT 1.8ft</p>
                    <p className="font-mono text-sm text-secondary-600">Tertiary Swell: 1.2ft @ 12s SSW (195°) | WVHT 0.9ft</p>
                    <p className="font-mono text-sm text-secondary-600">Wind: 5-10kts NW (320°) | WSPD 8kts | WVDR 315°</p>
                    <p className="font-mono text-sm text-secondary-600">Tide: 2.3ft 0423 rising to 4.2ft 1047 | -0.2ft 1632</p>
                    <p className="font-mono text-sm text-secondary-600">MWD: 285° | APD: 9.2s | PRES: 1013.2mb ↓</p>
                  </div>
                  <div className="bg-secondary-50 p-4 rounded-lg">
                    <p className="text-sm text-secondary-600">"WNW groundswell combining with SW windswell creating inconsistent conditions. Primary swell generating shoulder-high+ sets with occasional plus faces on the better ones. Light+ NW flow early trending W. Mixed-mode sea state with 9ft faces on 16-second intervals during peak morning push. Watch for periodic SSW interference patterns and tide-induced backwash during mid-morning transition. Moderate crowd factor expected at primary peaks. Standard dawn patrol protocol advised."</p>
                  </div>
                  <div className="bg-secondary-50 p-4 rounded-lg space-y-2">
                    <p className="font-mono text-xs text-secondary-600">BUOY 46042: 3.8ft @ 15.2s WNW | 8.9ft faces</p>
                    <p className="font-mono text-xs text-secondary-600">BUOY 46012: 3.5ft @ 14.8s WNW | 8.2ft faces</p>
                    <p className="font-mono text-xs text-secondary-600">CDIP 179: 3.6ft @ 15.0s WNW | 8.5ft faces</p>
                  </div>
                </div>
              </div>

              {/* KookCast Forecast */}
              <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-primary-500">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-600 text-xl">🤖</span>
                  </div>
                  <div className="ml-3">
                    <p className="font-semibold text-primary-900">Your AI Surf Coach</p>
                    <p className="text-sm text-primary-500">Personalized & Clear</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {/* Surf Alert Box */}
                  <div className="bg-green-50 border border-dashed border-green-200 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">🎯</span>
                      <h3 className="text-xl font-semibold text-green-800">Perfect Match: Your Ideal Session Today</h3>
                    </div>
                    <p className="text-green-700 text-lg mb-2">Based on your intermediate skill level and preference for clean, shoulder-high waves</p>
                    <p className="text-green-700 text-lg">AI forecast predicts excellent conditions matching your surfing style</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary-50 p-3 rounded-lg text-center">
                      <p className="text-sm font-medium text-secondary-900">Wave Height</p>
                      <p className="text-sm text-secondary-600">4-5ft • Perfect for you</p>
                    </div>
                    <div className="bg-secondary-50 p-3 rounded-lg text-center">
                      <p className="text-sm font-medium text-secondary-900">Conditions</p>
                      <p className="text-sm text-secondary-600">✨ Clean & Glassy</p>
                    </div>
                  </div>

                  <div className="bg-secondary-50 p-4 rounded-lg">
                    <h5 className="font-medium text-secondary-900 mb-3">AI Coaching Tips</h5>
                    <div className="space-y-2">
                      <p className="text-sm text-secondary-600 flex items-start">
                        <span className="mr-2">🎯</span>
                        <span>Perfect conditions to practice your bottom turns - waves have good wall sections</span>
                      </p>
                      <p className="text-sm text-secondary-600 flex items-start">
                        <span className="mr-2">💡</span>
                        <span>Based on your progress, try taking off closer to the peak today</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="px-4 py-12 sm:py-16 bg-secondary-50">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center text-secondary-900 mb-8 sm:mb-12">
              How KookCast Works
            </h2>
            
            {/* Main Flow */}
            <div className="relative">
              {/* Connection Lines */}
              <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-primary-100 transform -translate-y-1/2"></div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 relative z-10">
                {/* Step 1 */}
                <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 transform hover:-translate-y-1 transition-transform duration-300">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mr-4">
                      <span className="text-2xl">🌊</span>
                    </div>
                    <h3 className="text-xl font-semibold text-secondary-900">Data Collection</h3>
                  </div>
                  <div className="space-y-4">
                    <p className="text-secondary-600">
                      We gather real-time data from multiple sources:
                    </p>
                    <ul className="space-y-2 text-secondary-600">
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>NOAA buoy data for wave height, period, and direction</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>Tide predictions from NOAA stations</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>Weather data for wind conditions</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 transform hover:-translate-y-1 transition-transform duration-300">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mr-4">
                      <span className="text-2xl">⚡</span>
                    </div>
                    <h3 className="text-xl font-semibold text-secondary-900">Real-Time Processing</h3>
                  </div>
                  <div className="space-y-4">
                    <p className="text-secondary-600">
                      Our system processes this data continuously:
                    </p>
                    <ul className="space-y-2 text-secondary-600">
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>Data is collected and processed every hour</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>Models update predictions based on new data</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>Reports are generated fresh each morning</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 transform hover:-translate-y-1 transition-transform duration-300">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mr-4">
                      <span className="text-2xl">🎯</span>
                    </div>
                    <h3 className="text-xl font-semibold text-secondary-900">Personalized Report</h3>
                  </div>
                  <div className="space-y-4">
                    <p className="text-secondary-600">
                      Generates your custom surf report:
                    </p>
                    <ul className="space-y-2 text-secondary-600">
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>Best times to surf based on conditions</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>Recommended board for the day</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>Skills to focus on during your session</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Details */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
                <div className="flex items-center mb-4">
                  <span className="text-2xl mr-3">⚡</span>
                  <h3 className="text-xl font-semibold text-secondary-900">Continuous Learning</h3>
                </div>
                <ul className="space-y-2 text-secondary-600">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>System learns from your session ratings</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Improves recommendations over time</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Adapts to your changing preferences</span>
                  </li>
                </ul>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
                <div className="flex items-center mb-4">
                  <span className="text-2xl mr-3">🔒</span>
                  <h3 className="text-xl font-semibold text-secondary-900">Data Security</h3>
                </div>
                <ul className="space-y-2 text-secondary-600">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Your data is encrypted and secure</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>We never share your information</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>You control your preferences</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="px-4 py-12 sm:py-16 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <h3 className="text-2xl sm:text-3xl font-bold text-center text-secondary-900 mb-8 sm:mb-12">Choose Your Plan</h3>
          <div className="grid grid-cols-1 gap-6 sm:gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="p-6 sm:p-8 bg-white rounded-2xl border border-secondary-200 shadow-lg">
              <h3 className="text-2xl font-bold text-secondary-900">Free</h3>
              <p className="mt-4 text-secondary-600">Start your personalized surf journey</p>
              <div className="mt-2 text-2xl font-bold text-secondary-900">$0/month</div>
              <ul className="mt-8 space-y-4">
                <li className="flex items-center">
                  <span className="text-primary-500 mr-2">🤖</span>
                  AI-powered surf forecasts for one spot
                </li>
                <li className="flex items-center">
                  <span className="text-primary-500 mr-2">🎯</span>
                  Personalized to your skill level
                </li>
                <li className="flex items-center">
                  <span className="text-primary-500 mr-2">📧</span>
                  Daily email delivery (5:00 AM)
                </li>
              </ul>
              <button 
                onClick={() => {
                  localStorage.removeItem('signupType');
                  setIsSignUpModalOpen(true);
                }}
                className="mt-8 w-full px-6 py-3 text-center text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
              >
                Start Free
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-4 py-12 border-t border-secondary-200">
          <div className="max-w-7xl mx-auto flex flex-col items-center">
            <div className="flex flex-wrap justify-center gap-4 text-secondary-600">
              <Link href="/terms" className="hover:text-primary-600">Terms</Link>
              <Link href="/privacy" className="hover:text-primary-600">Privacy</Link>
              <Link href="/contact" className="hover:text-primary-600">Contact</Link>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8 text-secondary-500">
              <div className="flex items-center">
                <span className="mr-2">🔒</span>
                <span className="text-sm">Cancel anytime</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2">📱</span>
                <span className="text-sm">Works on all devices</span>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* Spot Selection Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-secondary-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-secondary-900">
                  {showConfirmation ? 'Confirm Your Spot' : 'Choose Your Free Spot'}
                </h3>
                <button 
                  onClick={() => {
                    setShowModal(false);
                    setSelectedSpot(null);
                    setShowConfirmation(false);
                  }}
                  className="text-secondary-400 hover:text-secondary-500"
                >
                  ✕
                </button>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-blue-800">
                  After selecting your spot, we'll ask a few quick questions about your surfing experience and preferences. This helps us provide forecasts that match your skill level and style.
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-blue-800">
                  After selecting your spot, we'll ask a few quick questions about your surfing experience and preferences. This helps us provide forecasts that match your skill level and style.
                </p>
              </div>
              {!showConfirmation && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-secondary-500">🔍</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Search by spot name or region..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-secondary-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-secondary-900"
                  />
                </div>
              )}
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                {filteredSpots.map((spot) => (
                  <button
                    key={spot.id}
                    onClick={() => handleSpotSelection(spot)}
                    className={`w-full p-4 text-left rounded-lg transition-all duration-200 border ${
                      showConfirmation
                        ? spot.id === selectedSpot?.id
                          ? 'bg-green-50 border-green-200 shadow-md hover:shadow-lg'
                          : 'bg-secondary-50 border-secondary-200 opacity-50 cursor-not-allowed'
                        : 'bg-white hover:bg-secondary-50 border-secondary-200 shadow-sm hover:shadow-md'
                    }`}
                    disabled={showConfirmation && spot.id !== selectedSpot?.id}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                        {showConfirmation ? (
                          spot.id === selectedSpot?.id ? (
                            <span className="text-green-600 text-lg">✓</span>
                          ) : (
                            <span className="text-secondary-400">🔒</span>
                          )
                        ) : null}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${
                            showConfirmation && spot.id === selectedSpot?.id
                              ? 'text-green-800'
                              : 'text-secondary-900'
                          }`}>
                            {spot.name}
                          </span>
                          {spot.isPopular && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">Popular</span>
                          )}
                        </div>
                        <div className={`text-sm mt-1 ${
                          showConfirmation && spot.id === selectedSpot?.id
                            ? 'text-green-700'
                            : 'text-secondary-500'
                        }`}>
                          {spot.region}
                        </div>
                        <p className={`text-sm mt-2 ${
                          showConfirmation && spot.id === selectedSpot?.id
                            ? 'text-green-600'
                            : 'text-secondary-600'
                        }`}>
                          {spot.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}

                {/* Locked Spots Teaser */}
                <div className="mt-6 p-4 bg-secondary-50 rounded-lg border border-secondary-200">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="font-medium text-secondary-900">Want access to all spots?</h4>
                      <p className="text-sm text-secondary-600 mt-1">Upgrade to Kook+ to get forecasts for multiple spots</p>
                    </div>
                    <button 
                      onClick={() => {
                        setShowModal(false);
                        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                    >
                      Go Kook+
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-secondary-200 bg-secondary-50">
              {showConfirmation ? (
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={handleSpotCancel}
                    className="px-4 py-2 text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                  >
                    Choose Different Spot
                  </button>
                  <button
                    onClick={handleSpotConfirmation}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Confirm & Continue
                  </button>
                </div>
              ) : (
                <p className="text-sm text-secondary-600 text-center">
                  Choose your spot carefully - Free plan includes one spot only
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showPrefsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-secondary-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => {
                      setShowPrefsModal(false);
                      setShowModal(true);
                    }}
                    className="text-secondary-400 hover:text-secondary-500"
                  >
                    ←
                  </button>
                  <h3 className="text-xl font-semibold text-secondary-900">Confirm Your Spot</h3>
                </div>
                <button 
                  onClick={() => setShowPrefsModal(false)}
                  className="text-secondary-400 hover:text-secondary-500"
                >
                  ✕
                </button>
              </div>
              {selectedSpot && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200 shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-green-800">{selectedSpot.name}</span>
                    {selectedSpot.isPopular && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">Popular</span>
                    )}
                  </div>
                  <div className="text-sm text-green-700 mt-1">{selectedSpot.region}</div>
                  <p className="text-sm text-green-600 mt-2">{selectedSpot.description}</p>
                </div>
              )}
              <p className="text-secondary-600 mb-4">Tell us what kind of waves you like to surf.</p>
              <p className="text-sm text-secondary-500 mb-6">(Just a sentence or two is perfect — we'll do the rest.)</p>
              <textarea
                value={surfPreference}
                onChange={(e) => setSurfPreference(e.target.value)}
                placeholder="Example: I'm still learning and prefer smaller, clean waves where I can practice popping up and riding the white water..."
                className="w-full p-4 h-32 rounded-lg border border-secondary-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-secondary-900 resize-none"
              />
            </div>
            
            <div className="p-6 bg-secondary-50 border-t border-secondary-200">
              <div className="flex flex-col items-center">
                <button
                  onClick={handlePreferenceSubmit}
                  className="w-full px-8 py-4 bg-green-600 text-white rounded-xl text-lg font-medium hover:bg-green-700 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  <span>🌊</span>
                  Let's Go Surfing!
                </button>
                <p className="mt-3 text-sm text-secondary-500">Your personalized forecasts start tomorrow</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sign In Modal */}
      {isSignInModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-secondary-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-secondary-900 mb-1">Sign In</h3>
                  <p className="text-gray-500 text-base">Welcome back to KookCast</p>
                </div>
                <button 
                  onClick={() => setIsSignInModalOpen(false)}
                  className="text-secondary-400 hover:text-secondary-500"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6">
              {error && (
                <div className="bg-red-50 p-4 rounded-lg mb-4">
                  <p className="text-red-800">{error}</p>
                </div>
              )}
              <form onSubmit={handleSignIn} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12H8m8 0a4 4 0 11-8 0 4 4 0 018 0zm0 0v1a4 4 0 01-8 0v-1" /></svg>
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
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
                    autoComplete="current-password"
                  />
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-xs text-gray-400 text-center">We'll never share your email.</span>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 px-8 rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 transition-colors text-base font-semibold min-w-[120px]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center"><svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>Signing in...</span>
                  ) : 'Sign In'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Sign Up Modal */}
      <Modal
        isOpen={isSignUpModalOpen}
        onClose={() => setIsSignUpModalOpen(false)}
        title="Join KookCast"
        disableClickOutside={true}
      >
        <MultiStepSignUp initialEmail={email} />
      </Modal>
    </div>
  );
}
