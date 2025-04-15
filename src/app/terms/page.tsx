import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service - KookCast',
  description: 'Terms of Service for using KookCast surf forecasting service',
};

export default function TermsPage() {
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
        
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
        
        <div className="prose prose-lg">
          <p className="text-gray-600 mb-6">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
          <p className="text-gray-600 mb-4">
            By accessing and using KookCast ("Service"), you accept and agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service. These Terms constitute a legally binding agreement between you and KookCast.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Description of Service</h2>
          <p className="text-gray-600 mb-4">
            KookCast provides surf forecasting services, delivering daily surf reports to your email inbox. The service includes both free and premium (Kook+) tiers with different features and limitations. We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. User Accounts</h2>
          <p className="text-gray-600 mb-4">
            To use KookCast, you must create an account with a valid email address. You are responsible for:
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-4">
            <li>Maintaining the confidentiality of your account information</li>
            <li>All activities that occur under your account</li>
            <li>Providing accurate and complete information</li>
            <li>Notifying us immediately of any unauthorized use of your account</li>
          </ul>
          <p className="text-gray-600 mb-4">
            We reserve the right to suspend or terminate accounts that violate these Terms or engage in fraudulent or abusive behavior.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Subscription and Payments</h2>
          <p className="text-gray-600 mb-4">
            Kook+ subscriptions are billed on a monthly basis. By subscribing, you agree to:
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-4">
            <li>Pay all fees associated with your subscription</li>
            <li>Provide accurate billing information</li>
            <li>Authorize us to charge your payment method</li>
          </ul>
          <p className="text-gray-600 mb-4">
            You can cancel your subscription at any time. No refunds are provided for partial months of service. We reserve the right to change subscription fees with 30 days' notice.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Intellectual Property</h2>
          <p className="text-gray-600 mb-4">
            All content, features, and functionality of the Service are owned by KookCast and are protected by international copyright, trademark, and other intellectual property laws. You may not:
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-4">
            <li>Copy, modify, or create derivative works</li>
            <li>Reverse engineer or attempt to extract source code</li>
            <li>Use the Service for any commercial purpose without authorization</li>
            <li>Remove or alter any copyright, trademark, or other proprietary notices</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Limitation of Liability</h2>
          <p className="text-gray-600 mb-4">
            KookCast provides surf forecasts based on available data and models. While we strive for accuracy, we cannot guarantee the accuracy of our forecasts. The Service is provided "as is" without warranties of any kind. You acknowledge that:
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-4">
            <li>Surf conditions can change rapidly and unpredictably</li>
            <li>You use the Service at your own risk</li>
            <li>We are not liable for any decisions made based on our forecasts</li>
            <li>We are not responsible for any injuries or damages resulting from surfing</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Data Usage and Privacy</h2>
          <p className="text-gray-600 mb-4">
            We collect and use your data in accordance with our Privacy Policy. By using KookCast, you consent to our data practices as described in the Privacy Policy.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Prohibited Activities</h2>
          <p className="text-gray-600 mb-4">
            You agree not to:
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-4">
            <li>Use the Service for any illegal purpose</li>
            <li>Attempt to gain unauthorized access to the Service</li>
            <li>Interfere with the proper functioning of the Service</li>
            <li>Use automated means to access the Service</li>
            <li>Share your account credentials with others</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. Termination</h2>
          <p className="text-gray-600 mb-4">
            We may terminate or suspend your access to the Service immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. Changes to Terms</h2>
          <p className="text-gray-600 mb-4">
            We reserve the right to modify these Terms at any time. We will notify users of any material changes via email or through the Service. Your continued use of the Service after such changes constitutes acceptance of the new Terms.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">11. Governing Law</h2>
          <p className="text-gray-600 mb-4">
            These Terms shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of law provisions. Any disputes shall be resolved in the courts of San Francisco County, California.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">12. Contact</h2>
          <p className="text-gray-600 mb-4">
            For any questions about these Terms of Service, please contact us at{' '}
            <a href="mailto:griffin@kook-cast.com" className="text-blue-600 hover:text-blue-800">
              griffin@kook-cast.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
} 