"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

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

  const handleSpotSelection = (spot: Spot) => {
    setSelectedSpot(spot);
    setShowModal(false);
    setShowPrefsModal(true);
  };

  const handlePreferenceSubmit = () => {
    console.log('Selected spot:', selectedSpot);
    console.log('Surf preference:', surfPreference);
    setShowPrefsModal(false);
    // Here you would typically handle the signup with the collected data
  };

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-primary-600">KookCast</h1>
          <nav className="flex space-x-4">
            <button onClick={() => document.getElementById('email-comparison')?.scrollIntoView({ behavior: 'smooth' })} className="text-secondary-600 hover:text-primary-600">Features</button>
            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="text-secondary-600 hover:text-primary-600">Pricing</button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 pt-12 pb-16 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mb-8 inline-flex items-center px-4 py-1.5 rounded-full bg-primary-50 text-primary-700 text-sm font-medium">
            <span className="mr-2">🎉</span>
            Join 2,000+ surfers getting clear, simple forecasts
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-secondary-900 sm:text-6xl">
            Your Daily Surf Forecast,<br />
            <span className="text-primary-600">Finally Made Simple</span>
          </h1>
          <p className="mt-6 text-xl text-secondary-600 max-w-2xl mx-auto">
            Stop wasting time with confusing surf reports. Get personalized, actionable forecasts that match your 
            style and skill level, delivered before dawn patrol.
          </p>
          <div className="mt-8 flex flex-col items-center gap-y-4">
            <div className="flex flex-col items-center gap-4 w-full max-w-md">
              <div className="w-full flex gap-x-4">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 rounded-lg border border-secondary-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button 
                  onClick={() => setShowModal(true)}
                  className="px-8 py-3 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors font-medium whitespace-nowrap"
                >
                  Sign Up Free
                </button>
              </div>
              <div className="flex flex-col items-center gap-2 text-sm text-secondary-500">
                <p className="text-center">Free forever • No credit card • Choose from 20+ California spots</p>
              </div>
            </div>
          </div>
          
          {/* Trust Indicators */}
          <div className="mt-6 flex justify-center items-center gap-x-6 text-secondary-500">
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
          <div className="mt-16 relative">
            <div className="mb-4 text-center">
              <span className="bg-primary-600 text-white px-4 py-1.5 rounded-full text-sm font-medium inline-flex items-center gap-x-1">
                <span>📧</span>
                Example Daily Email
              </span>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto transform hover:-translate-y-1 transition-transform duration-300">
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
              
              {/* Email Body */}
              <div className="space-y-6">
                {/* Main Summary */}
                <div className="bg-primary-50 p-4 rounded-lg text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-primary-600 font-medium">✅ Looking good today!</span>
                    <span className="text-primary-400">•</span>
                    <span className="text-primary-600 font-medium">Get there by 5am</span>
                  </div>
                  <p className="text-primary-600 font-medium text-lg">Beautiful morning ahead with clean, rolling lefts coming through</p>
                  <p className="text-sm text-primary-500 mt-2">Light offshore breeze keeping everything glassy until mid-morning</p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary-50 p-3 rounded-lg text-center">
                    <p className="text-sm font-medium text-secondary-900">Wave Size</p>
                    <p className="text-sm text-secondary-600">Waist high • Clean shape</p>
                  </div>
                  <div className="bg-secondary-50 p-3 rounded-lg text-center">
                    <p className="text-sm font-medium text-secondary-900">Wind</p>
                    <p className="text-sm text-secondary-600">✨ Light offshore</p>
                  </div>
                  <div className="bg-secondary-50 p-3 rounded-lg text-center">
                    <p className="text-sm font-medium text-secondary-900">Water Temp</p>
                    <p className="text-sm text-secondary-600">58°F (3/2mm)</p>
                  </div>
                  <div className="bg-secondary-50 p-3 rounded-lg text-center">
                    <p className="text-sm font-medium text-secondary-900">Vibe Today</p>
                    <p className="text-sm text-secondary-600">Gentle & Easygoing</p>
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
                      <span className="text-secondary-600">4-6pm (🌬️ slight texture)</span>
                    </div>
                  </div>
                </div>

                {/* Tips Section */}
                <div className="bg-secondary-50 p-4 rounded-lg">
                  <h5 className="font-medium text-secondary-900 mb-3 text-center">Quick Tips</h5>
                  <div className="space-y-2">
                    <p className="text-sm text-secondary-600 flex items-start justify-center">
                      <span className="mr-2">👥</span>
                      <span>Light crowd - great for practicing</span>
                    </p>
                    <p className="text-sm text-secondary-600 flex items-start justify-center">
                      <span className="mr-2">💡</span>
                      <span>Look for darker patches of water - these are usually the best waves</span>
                    </p>
                    <p className="text-sm text-secondary-600 flex items-start justify-center">
                      <span className="mr-2">⚠️</span>
                      <span>Watch out for small rip currents near the pier</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
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
          <h3 className="text-3xl font-bold text-center text-secondary-900 mb-8">No More Confusing Forecasts</h3>
          <div className="grid md:grid-cols-2 gap-8">
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
                  <p className="font-mono text-sm text-secondary-600">Primary Swell: 3.8ft @ 15s WNW (290°)</p>
                  <p className="font-mono text-sm text-secondary-600">Secondary Swell: 2.1ft @ 8s SW (210°)</p>
                  <p className="font-mono text-sm text-secondary-600">Wind: 5-10mph NW (320°)</p>
                  <p className="font-mono text-sm text-secondary-600">Tide: 2.3ft rising to 4.2ft</p>
                </div>
                <div className="bg-secondary-50 p-4 rounded-lg">
                  <p className="text-sm text-secondary-600">"Moderate NW swell with light offshore winds. Secondary SW swell adding texture. Tide push incoming. Watch for rip currents."</p>
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
                <div className="bg-primary-50 p-4 rounded-lg text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-primary-600 font-medium">✅ Looking good today!</span>
                    <span className="text-primary-400">•</span>
                    <span className="text-primary-600 font-medium">Get there by 5am</span>
                  </div>
                  <p className="text-primary-600 font-medium text-lg">Beautiful morning ahead with clean, rolling lefts coming through</p>
                  <p className="text-sm text-primary-500 mt-2">Light offshore breeze keeping everything glassy until mid-morning</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary-50 p-3 rounded-lg text-center">
                    <p className="text-sm font-medium text-secondary-900">Wave Size</p>
                    <p className="text-sm text-secondary-600">Waist high • Clean shape</p>
                  </div>
                  <div className="bg-secondary-50 p-3 rounded-lg text-center">
                    <p className="text-sm font-medium text-secondary-900">Vibe Today</p>
                    <p className="text-sm text-secondary-600">Gentle & Easygoing</p>
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
                      <span>Look for darker patches of water for best waves</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="px-4 py-16 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <h3 className="text-3xl font-bold text-center text-secondary-900 mb-12">Choose Your Plan</h3>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Free Plan */}
          <div className="p-8 bg-white rounded-2xl border border-secondary-200 shadow-lg">
            <h3 className="text-2xl font-bold text-secondary-900">Free</h3>
            <p className="mt-4 text-secondary-600">Perfect for casual surfers</p>
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
            <button className="mt-8 w-full px-6 py-3 text-center text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition-colors">
              Start Free
            </button>
          </div>

          {/* Pro Plan */}
          <div className="p-8 bg-primary-600 rounded-2xl text-white shadow-lg">
            <h3 className="text-2xl font-bold">Pro</h3>
            <p className="mt-4 opacity-90">For the dedicated surfer</p>
            <div className="mt-2 text-2xl font-bold">$5/month</div>
            <ul className="mt-8 space-y-4">
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                Multiple surf spots
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                Customizable delivery time
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                Personalized recommendations
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                Weekly "Best Days" outlook
              </li>
              <li className="flex items-center">
                <span className="mr-2">✓</span>
                Early access to new sports
              </li>
            </ul>
            <button className="mt-8 w-full px-6 py-3 text-center bg-white text-primary-600 rounded-lg hover:bg-secondary-50 transition-colors">
              Go Pro
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-12 border-t border-secondary-200">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <div className="flex space-x-6 text-secondary-600">
            <Link href="/terms" className="hover:text-primary-600">Terms</Link>
            <Link href="/privacy" className="hover:text-primary-600">Privacy</Link>
            <Link href="/contact" className="hover:text-primary-600">Contact</Link>
          </div>
          <div className="mt-6 flex justify-center items-center gap-x-8 text-secondary-500">
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
        </div>
      </footer>

      {/* Spot Selection Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-secondary-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-secondary-900">Choose Your Free Spot</h3>
                <button 
                  onClick={() => setShowModal(false)}
                  className="text-secondary-400 hover:text-secondary-500"
                >
                  ✕
                </button>
              </div>
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
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                {filteredSpots.map((spot) => (
                  <button
                    key={spot.id}
                    onClick={() => handleSpotSelection(spot)}
                    className="w-full p-4 text-left bg-white hover:bg-secondary-50 rounded-lg transition-colors border border-secondary-200 shadow-sm hover:shadow-md"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-secondary-900">{spot.name}</span>
                          {spot.isPopular && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">Popular</span>
                          )}
                        </div>
                        <div className="text-sm text-secondary-500 mt-1">{spot.region}</div>
                        <p className="text-sm text-secondary-600 mt-2">{spot.description}</p>
                      </div>
                    </div>
                  </button>
                ))}

                {/* Locked Spots Teaser */}
                <div className="mt-6 p-4 bg-secondary-50 rounded-lg border border-secondary-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-secondary-900">Want access to all spots?</h4>
                      <p className="text-sm text-secondary-600 mt-1">Upgrade to Pro to get forecasts for multiple spots</p>
                    </div>
                    <button 
                      onClick={() => {
                        setShowModal(false);
                        // Add logic to scroll to pricing section
                        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                    >
                      Go Pro
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-secondary-200 bg-secondary-50">
              <p className="text-sm text-secondary-600 text-center">
                Choose your spot carefully - Free plan includes one spot only
              </p>
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
                <h3 className="text-xl font-semibold text-secondary-900">One last thing...</h3>
                <button 
                  onClick={() => setShowPrefsModal(false)}
                  className="text-secondary-400 hover:text-secondary-500"
                >
                  ✕
                </button>
              </div>
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
                  className="w-full px-8 py-4 bg-primary-600 text-white rounded-xl text-lg font-medium hover:bg-primary-700 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
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
    </main>
  );
}
