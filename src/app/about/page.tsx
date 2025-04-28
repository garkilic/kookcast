"use client";

import Link from "next/link";
import { useRouter } from 'next/navigation';

export default function About() {
  const router = useRouter();

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
            <button 
              onClick={() => router.push('/')}
              className="text-sm sm:text-base text-secondary-600 hover:text-primary-600"
            >
              Home
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-12 mx-auto max-w-4xl">
        {/* Developer Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-secondary-900 mb-6">About the Developer</h2>
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-4xl">👨‍💻</span>
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-secondary-900">Griffin Arkilic</h3>
                <p className="text-secondary-600">Full Stack Developer & Surf Enthusiast</p>
              </div>
            </div>
            <p className="text-secondary-600 mb-4">
              Hey y'all, my name is Griffin, nice to meet you.I'm a solo developer who lives in Los Angeles, and I built the very app you are using right now. I wanted something that would tell me when to surf at Venice Beach, so I spent a month building something I thought was cool. 
            </p>
            <p className="text-secondary-600">
              This was built for me, but also for you. Surfing is something I love, but it can be super intimidating. 
              I wanted to solve that. This is V1 of this project, and I wanted to give you insight into what I am working on next.
            </p>
            <p className="text-secondary-600">
             <br></br> If you have any ideas or feedback, send me an email at <a href="mailto:griffin@kook-cast.com" className="text-primary-600 hover:text-primary-700">griffin@kook-cast.com</a>
            </p>
          </div>
        </section>

        {/* Roadmap Section */}
        <section>
          <h2 className="text-3xl font-bold text-secondary-900 mb-6">Feature Roadmap</h2>
          <div className="space-y-6">
            {/* Current Development */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-xl font-semibold text-secondary-900 mb-4 flex items-center">
                <span className="mr-2">🚀</span>
                Currently in Development
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="mr-2">⚡</span>
                  <div>
                    <p className="font-medium text-secondary-900">SMS Surf Alerts</p>
                    <p className="text-secondary-600">Texts when the surf is good (for you)</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">🤖</span>
                  <div>
                    <p className="font-medium text-secondary-900">Enhanced AI Predictions</p>
                    <p className="text-secondary-600">More accurate wave predictions using machine learning</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">📊</span>
                  <div>
                    <p className="font-medium text-secondary-900">Advanced Analytics</p>
                    <p className="text-secondary-600">Detailed session tracking and progress analysis</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">👥</span>
                  <div>
                    <p className="font-medium text-secondary-900">Expand Areas</p>
                    <p className="text-secondary-600">Expand to more areas, and more spots within those areas</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Planned Features */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-xl font-semibold text-secondary-900 mb-4 flex items-center">
                <span className="mr-2">🎯</span>
                Planned Features
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="mr-2">👥</span>
                  <div>
                    <p className="font-medium text-secondary-900">Surf Community</p>
                    <p className="text-secondary-600">Connect with other surfers and share conditions</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">📱</span>
                  <div>
                    <p className="font-medium text-secondary-900">User Spot "Bug Bounty"</p>
                    <p className="text-secondary-600">When you go to a spot, you can submit information about the spot, and get rewards.</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">🎥</span>
                  <div>
                    <p className="font-medium text-secondary-900">Merch</p>
                    <p className="text-secondary-600">I want simple merch that says "Anybody Can Surf"</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">📈</span>
                  <div>
                    <p className="font-medium text-secondary-900">Historical Data Analysis</p>
                    <p className="text-secondary-600">Track conditions over time to find patterns</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Future Ideas */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-xl font-semibold text-secondary-900 mb-4 flex items-center">
                <span className="mr-2">💡</span>
                Future Ideas
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="mr-2">🎓</span>
                 
                </li>
                <li className="flex items-start">
                  <span className="mr-2">🌍</span>
                  <div>
                    <p className="font-medium text-secondary-900">Global Expansion</p>
                    <p className="text-secondary-600">Cover more surf spots worldwide</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">🤝</span>
                  <div>
                    <p className="font-medium text-secondary-900">Surf Shop Integration</p>
                    <p className="text-secondary-600">Connect with local surf shops for gear recommendations</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-4 py-8 border-t border-secondary-200 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <div className="flex flex-wrap justify-center gap-4 text-secondary-600">
            <Link href="/terms" className="hover:text-primary-600">Terms</Link>
            <Link href="/privacy" className="hover:text-primary-600">Privacy</Link>
            <Link href="/contact" className="hover:text-primary-600">Contact</Link>
          </div>
          <p className="mt-4 text-sm text-secondary-500 text-center">
            Have ideas or feedback? Email me at <a href="mailto:griffin@kook-cast.com" className="text-primary-600 hover:text-primary-700">griffin@kook-cast.com</a>
          </p>
        </div>
      </footer>
    </div>
  );
} 