import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contact Us - KookCast',
  description: 'Get in touch with the KookCast team',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Link 
          href="/" 
          className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-8"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Contact Us</h1>
        
        <div className="prose prose-lg">
          <p className="text-gray-600 mb-6">
            We'd love to hear from you! Whether you have questions about our service, need help with your account, or want to suggest new features, we're here to help.
          </p>

          <div className="bg-primary-50 p-6 rounded-xl mb-8">
            <h2 className="text-2xl font-semibold text-primary-900 mb-4">Meet Griffin</h2>
            <p className="text-primary-700 mb-4">
              Hey there! I'm Griffin, the founder of KookCast. I'm a surfer just like you, and I built this service because I was tired of confusing surf reports. I'm always happy to chat about surfing, weather patterns, or anything else on your mind.
            </p>
            <p className="text-primary-700">
              Don't hesitate to reach out - whether it's about the service, surf spots, or just to say hi! I read and respond to every email personally.
            </p>
          </div>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Email Us</h2>
          <p className="text-gray-600 mb-4">
            The best way to reach us is via email at{' '}
            <a href="mailto:griffin@kook-cast.com" className="text-blue-600 hover:text-blue-800">
              griffin@kook-cast.com
            </a>
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Response Time</h2>
          <p className="text-gray-600 mb-4">
            We typically respond to all emails within 24 hours. If you're a Kook+ member, you'll receive priority support.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Common Questions</h2>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900">Account Issues</h3>
              <p className="text-gray-600 mt-1">
                Having trouble with your account? Include your email address and a description of the issue.
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900">Feature Requests</h3>
              <p className="text-gray-600 mt-1">
                Want to see a new surf spot or feature? Let us know what you'd like to see added to KookCast.
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900">Kook+ Support</h3>
              <p className="text-gray-600 mt-1">
                Need help with your Kook+ subscription? Include your email address and subscription details.
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Can't Afford Kook+?</h2>
          <p className="text-gray-600 mb-4">
            We believe surfing should be accessible to everyone. If you can't afford Kook+, email us and we'll hook you up with a free premium account.
          </p>
        </div>
      </div>
    </div>
  );
} 