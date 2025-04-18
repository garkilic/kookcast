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
  const [email, setEmail] = useState('');
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
        email.trim(),
        password
      );

      if (!userCredential.user) {
        throw new Error('Authentication failed');
      }

      // Close the modal and clear form
      setIsSignInModalOpen(false);
      setEmail('');
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
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-600">KookCast</h1>
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
              onClick={() => document.getElementById('email-comparison')?.scrollIntoView({ behavior: 'smooth' })} 
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section className="px-4 pt-8 sm:pt-12 pb-12 sm:pb-16 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-6 sm:mb-8 inline-flex items-center px-3 sm:px-4 py-1.5 rounded-full bg-primary-50 text-primary-700 text-sm font-medium">
              <span className="mr-2">🎉</span>
              Join 2,000+ surfers getting clear, simple forecasts
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-secondary-900">
              Your Daily Surf Forecast,<br />
              <span className="text-primary-600">Finally Made Simple</span>
            </h1>
            <p className="mt-4 sm:mt-6 text-lg sm:text-xl text-secondary-600 max-w-2xl mx-auto">
              Stop wasting time with confusing surf reports. Get personalized, actionable forecasts that match your 
              style and skill level, delivered before dawn patrol.
            </p>
            <div className="mt-8 flex flex-col items-center gap-y-4">
              <div className="flex flex-col items-center gap-4 w-full max-w-md">
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
                    Sign Up Free
                  </button>
                </form>
                <div className="flex flex-col items-center gap-2 text-sm text-secondary-500">
                  <p className="text-center">Free forever • No credit card • Choose from 20+ California spots</p>
                </div>
              </div>
            </div>
            
            {/* Trust Indicators */}
            <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6 text-secondary-500">
              <div className="flex items-center">
                <span className="mr-2">📍</span>
                <span className="text-sm">20+ spots available in California</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2">✨</span>
                <span className="text-sm">New spots added monthly</span>
              </div>
            </div>

            {/* Example Preview Card */}
            <div className="mt-12 sm:mt-16 relative">
              <div className="mb-4 text-center">
                <span className="bg-primary-600 text-white px-4 py-1.5 rounded-full text-sm font-medium inline-flex items-center gap-x-1">
                  <span>📧</span>
                  Example Daily Email
                </span>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 max-w-2xl mx-auto transform hover:-translate-y-1 transition-transform duration-300">
                {/* Email Header */}
                <div className="flex items-center justify-between mb-6 border-b border-secondary-200 pb-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-600 text-xl">🏄‍♂️</span>
                    </div>
                    <div className="ml-3">
                      <p className="font-semibold text-secondary-900">Ocean Beach Forecast</p>
                      <p className="text-sm text-secondary-500">Example Preview • 5:00 AM</p>
                    </div>
                  </div>
                </div>

                {/* Surf Alert Box */}
                <div className="bg-green-50 border border-dashed border-green-200 rounded-lg p-6 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🌊</span>
                    <h3 className="text-xl font-semibold text-green-800">Surf Alert: Ideal Conditions at 5:00–8:00am</h3>
                  </div>
                  <p className="text-green-700 text-lg mb-2">Beautiful morning ahead with clean, rolling lefts coming through</p>
                  <p className="text-green-700 text-lg">Light offshore breeze keeping everything glassy until mid-morning</p>
                </div>

                {/* Email Body */}
                <div className="space-y-6">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary-50 p-3 rounded-lg text-center">
                      <p className="text-sm font-medium text-secondary-900">Wave Size</p>
                      <p className="text-sm text-secondary-600">3-4ft • Clean shape</p>
                    </div>
                    <div className="bg-secondary-50 p-3 rounded-lg text-center">
                      <p className="text-sm font-medium text-secondary-900">Wind</p>
                      <p className="text-sm text-secondary-600">✨ 5-8mph Offshore</p>
                    </div>
                    <div className="bg-secondary-50 p-3 rounded-lg text-center">
                      <p className="text-sm font-medium text-secondary-900">Water Temp</p>
                      <p className="text-sm text-secondary-600">58°F (3/2mm)</p>
                    </div>
                    <div className="bg-secondary-50 p-3 rounded-lg text-center">
                      <p className="text-sm font-medium text-secondary-900">Vibe Today</p>
                      <p className="text-sm text-secondary-600">Clean & Consistent</p>
                    </div>
                  </div>

                  {/* Session Times */}
                  <div className="bg-secondary-50 p-4 rounded-lg">
                    <h5 className="font-medium text-secondary-900 mb-3 text-center">Best Times to Surf</h5>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-secondary-200 pb-2">
                        <div className="flex items-center">
                          <span className="mr-2">⏰</span>
                          <span className="font-medium">Morning Session</span>
                        </div>
                        <span className="text-secondary-600">5:00-8:00am (✨ glassy)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="mr-2">🌅</span>
                          <span className="font-medium">Afternoon Session</span>
                        </div>
                        <span className="text-secondary-600">4:00-6:00pm (🌬️ light texture)</span>
                      </div>
                    </div>
                  </div>

                  {/* Tips Section */}
                  <div className="bg-secondary-50 p-4 rounded-lg">
                    <h5 className="font-medium text-secondary-900 mb-3 text-center">Quick Tips</h5>
                    <div className="space-y-2">
                      <p className="text-sm text-secondary-600 flex items-start justify-center">
                        <span className="mr-2">👥</span>
                        <span>Medium crowd expected - arrive early for best peaks</span>
                      </p>
                      <p className="text-sm text-secondary-600 flex items-start justify-center">
                        <span className="mr-2">💡</span>
                        <span>Best waves on the south end near the jetty</span>
                      </p>
                      <p className="text-sm text-secondary-600 flex items-start justify-center">
                        <span className="mr-2">⚠️</span>
                        <span>Watch for occasional closeouts during high tide</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto">
              <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="text-primary-600 text-2xl mb-4">⏰</div>
                <h3 className="font-semibold text-secondary-900">Never Miss Dawn Patrol</h3>
                <p className="mt-2 text-sm text-secondary-600">Your personalized forecast in your inbox by 5:00 AM, every day</p>
              </div>
              <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="text-primary-600 text-2xl mb-4">🎯</div>
                <h3 className="font-semibold text-secondary-900">Tailored to Your Style</h3>
                <p className="mt-2 text-sm text-secondary-600">Forecasts that match your skill level and preferences</p>
              </div>
              <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="text-primary-600 text-2xl mb-4">🌊</div>
                <h3 className="font-semibold text-secondary-900">Surf Your Way</h3>
                <p className="mt-2 text-sm text-secondary-600">Get recommendations that fit your surfing style and goals</p>
              </div>
            </div>
          </div>
        </section>

        {/* Email Comparison Section */}
        <section id="email-comparison" className="px-4 py-12 bg-secondary-50">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-2xl sm:text-3xl font-bold text-center text-secondary-900 mb-8">No More Confusing Forecasts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* Typical Forecast */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 rounded-full bg-secondary-100 flex items-center justify-center">
                    <span className="text-secondary-600 text-xl">📊</span>
                  </div>
                  <div className="ml-3">
                    <p className="font-semibold text-secondary-900">Typical Surf Report</p>
                    <p className="text-sm text-secondary-500">Today, 5:00 AM</p>
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

              {/* KookCast Email */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-600 text-xl">🏄‍♂️</span>
                  </div>
                  <div className="ml-3">
                    <p className="font-semibold text-secondary-900">KookCast</p>
                    <p className="text-sm text-secondary-500">Today, 5:00 AM</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {/* Surf Alert Box */}
                  <div className="bg-green-50 border border-dashed border-green-200 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">🌊</span>
                      <h3 className="text-xl font-semibold text-green-800">Surf Alert: Ideal Conditions at 5:00–8:00am</h3>
                    </div>
                    <p className="text-green-700 text-lg mb-2">Beautiful morning ahead with clean, rolling lefts coming through</p>
                    <p className="text-green-700 text-lg">Light offshore breeze keeping everything glassy until mid-morning</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary-50 p-3 rounded-lg text-center">
                      <p className="text-sm font-medium text-secondary-900">Wave Size</p>
                      <p className="text-sm text-secondary-600">3-4ft • Clean shape</p>
                    </div>
                    <div className="bg-secondary-50 p-3 rounded-lg text-center">
                      <p className="text-sm font-medium text-secondary-900">Wind</p>
                      <p className="text-sm text-secondary-600">✨ 5-8mph Offshore</p>
                    </div>
                  </div>

                  <div className="bg-secondary-50 p-4 rounded-lg">
                    <h5 className="font-medium text-secondary-900 mb-3">Quick Tips</h5>
                    <div className="space-y-2">
                      <p className="text-sm text-secondary-600 flex items-start">
                        <span className="mr-2">⏰</span>
                        <span>Best Time: 5:00-8:00am (✨ glassy)</span>
                      </p>
                      <p className="text-sm text-secondary-600 flex items-start">
                        <span className="mr-2">💡</span>
                        <span>Best waves on the south end near the jetty</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="px-4 py-12 sm:py-16 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <h3 className="text-2xl sm:text-3xl font-bold text-center text-secondary-900 mb-8 sm:mb-12">Choose Your Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="p-6 sm:p-8 bg-white rounded-2xl border border-secondary-200 shadow-lg">
              <h3 className="text-2xl font-bold text-secondary-900">Free</h3>
              <p className="mt-4 text-secondary-600">Perfect for casual surfers</p>
              <div className="mt-2 text-2xl font-bold text-secondary-900">$0/month</div>
              <ul className="mt-8 space-y-4">
                <li className="flex items-center">
                  <span className="text-primary-500 mr-2">✓</span>
                  Daily surf summary for one spot
                </li>
                <li className="flex items-center">
                  <span className="text-primary-500 mr-2">✓</span>
                  Fixed delivery time (5:00 AM)
                </li>
                <li className="flex items-center">
                  <span className="text-primary-500 mr-2">✓</span>
                  Go/Skip recommendations
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

            {/* Kook+ Plan */}
            <div className="p-6 sm:p-8 bg-white rounded-2xl border-2 border-primary-500 shadow-lg relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-primary-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                Popular
              </div>
              <h3 className="text-2xl font-bold text-secondary-900">Kook+</h3>
              <p className="mt-4 text-secondary-600">For the dedicated surfer</p>
              <div className="mt-2 text-2xl font-bold text-secondary-900">$5/month</div>
              <ul className="mt-8 space-y-4">
                <li className="flex items-center">
                  <span className="text-primary-500 mr-2">✓</span>
                  <strong>Multiple spot tracking</strong>
                </li>
                <li className="flex items-center">
                  <span className="text-primary-500 mr-2">✓</span>
                  Customizable delivery time
                </li>
                <li className="flex items-center">
                  <span className="text-primary-500 mr-2">✓</span>
                  Detailed condition breakdowns
                </li>
                <li className="flex items-center">
                  <span className="text-primary-500 mr-2">✓</span>
                  Priority support
                </li>
              </ul>
              <button 
                onClick={() => {
                  localStorage.setItem('signupType', 'premium');
                  setIsSignUpModalOpen(true);
                }}
                className="mt-8 w-full px-6 py-3 text-center text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Start Kook+
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
                <span className="mr-2">⭐</span>
                <span className="text-sm">5.0/5 from 200+ surfers</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2">🔒</span>
                <span className="text-sm">Cancel anytime</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2">📱</span>
                <span className="text-sm">Works on all devices</span>
              </div>
            </div>
            <p className="mt-6 text-sm text-secondary-500">
              Built by surfers. Runs on weather data, not BS.
            </p>
            <p className="mt-4 text-sm text-secondary-500 text-center max-w-md">
              Can't afford Kook+? No problem! Email me at{' '}
              <a href="mailto:griffin@kook-cast.com" className="text-primary-600 hover:text-primary-700 whitespace-nowrap">
                griffin@kook-cast.com
              </a>
              {' '}and I'll hook you up with a free premium account. Surfing should be accessible to everyone.
            </p>
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
                <h3 className="text-xl font-semibold text-secondary-900">Sign In</h3>
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
              <form onSubmit={handleSignIn} className="space-y-4">
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
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
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
      >
        <MultiStepSignUp initialEmail={email} />
      </Modal>
    </div>
  );
}
