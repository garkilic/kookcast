import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy - KookCast',
  description: 'Privacy Policy for KookCast surf forecasting service',
};

export default function PrivacyPage() {
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
        
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        
        <div className="prose prose-lg">
          <p className="text-gray-600 mb-6">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Introduction</h2>
          <p className="text-gray-600 mb-4">
            This Privacy Policy describes how KookCast ("we", "us", or "our") collects, uses, and shares your personal information when you use our surf forecasting service ("Service"). By using the Service, you agree to the collection and use of information in accordance with this policy.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Information We Collect</h2>
          <p className="text-gray-600 mb-4">
            We collect several types of information from and about users of our Service:
          </p>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900">Personal Information</h3>
              <ul className="list-disc pl-6 text-gray-600 mt-2">
                <li>Email address</li>
                <li>Password (encrypted)</li>
                <li>Selected surf spots</li>
                <li>Surfing preferences and skill level</li>
                <li>Payment information (for Kook+ subscribers)</li>
              </ul>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900">Usage Data</h3>
              <ul className="list-disc pl-6 text-gray-600 mt-2">
                <li>IP address</li>
                <li>Browser type and version</li>
                <li>Time and date of visits</li>
                <li>Pages viewed</li>
                <li>Time spent on pages</li>
              </ul>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. How We Use Your Information</h2>
          <p className="text-gray-600 mb-4">
            We use the collected information for various purposes:
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-4">
            <li>To provide and maintain our Service</li>
            <li>To send you surf forecasts and updates</li>
            <li>To process payments for Kook+ subscriptions</li>
            <li>To improve and personalize your experience</li>
            <li>To communicate with you about our Service</li>
            <li>To detect and prevent fraud</li>
            <li>To comply with legal obligations</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Data Storage and Security</h2>
          <p className="text-gray-600 mb-4">
            We implement appropriate security measures to protect your personal information:
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-4">
            <li>Data is encrypted in transit and at rest</li>
            <li>Regular security assessments and updates</li>
            <li>Access controls and authentication</li>
            <li>Secure data centers</li>
            <li>Regular backups</li>
          </ul>
          <p className="text-gray-600 mb-4">
            While we strive to protect your personal information, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Data Retention</h2>
          <p className="text-gray-600 mb-4">
            We retain your personal information for as long as your account is active or as needed to provide you services. We will retain and use your information as necessary to comply with our legal obligations, resolve disputes, and enforce our agreements.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Third-Party Services</h2>
          <p className="text-gray-600 mb-4">
            We use third-party services that may collect information about you:
          </p>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900">Payment Processing</h3>
              <p className="text-gray-600 mt-1">Stripe - For processing Kook+ subscription payments</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900">Email Delivery</h3>
              <p className="text-gray-600 mt-1">For sending surf forecasts and updates</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900">Analytics</h3>
              <p className="text-gray-600 mt-1">For understanding how users interact with our Service</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Your Rights</h2>
          <p className="text-gray-600 mb-4">
            Depending on your location, you may have certain rights regarding your personal information:
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-4">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to processing of your data</li>
            <li>Request restriction of processing</li>
            <li>Data portability</li>
            <li>Withdraw consent</li>
          </ul>
          <p className="text-gray-600 mb-4">
            To exercise these rights, please contact us at griffin@kook-cast.com.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Cookies and Tracking</h2>
          <p className="text-gray-600 mb-4">
            We use cookies and similar tracking technologies to:
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-4">
            <li>Remember your preferences</li>
            <li>Analyze Service usage</li>
            <li>Improve user experience</li>
            <li>Prevent fraud</li>
          </ul>
          <p className="text-gray-600 mb-4">
            You can control cookies through your browser settings. However, disabling cookies may affect your ability to use certain features of the Service.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. Children's Privacy</h2>
          <p className="text-gray-600 mb-4">
            Our Service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. International Data Transfers</h2>
          <p className="text-gray-600 mb-4">
            Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">11. Changes to Privacy Policy</h2>
          <p className="text-gray-600 mb-4">
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. Your continued use of the Service after such changes constitutes acceptance of the new Privacy Policy.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">12. Contact Us</h2>
          <p className="text-gray-600 mb-4">
            If you have any questions about this Privacy Policy, please contact us at{' '}
            <a href="mailto:griffin@kook-cast.com" className="text-blue-600 hover:text-blue-800">
              griffin@kook-cast.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
} 