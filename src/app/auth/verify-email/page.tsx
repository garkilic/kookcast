'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { sendEmailVerification } from 'firebase/auth';

export default function VerifyEmail() {
  const [email, setEmail] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (auth.currentUser) {
      setEmail(auth.currentUser.email || '');
    }
  }, []);

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;

    try {
      await sendEmailVerification(auth.currentUser);
      setVerificationSent(true);
    } catch (error: any) {
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Verify Your Email</h1>
        
        {verificationSent ? (
          <div className="bg-green-50 p-4 rounded-lg mb-4">
            <p className="text-green-800">
              Verification email sent to <span className="font-semibold">{email}</span>
            </p>
          </div>
        ) : (
          <div className="bg-blue-50 p-4 rounded-lg mb-4">
            <p className="text-blue-800">
              Please verify your email address to access the dashboard.
            </p>
            <p className="text-sm text-blue-600 mt-2">
              We've sent a verification email to <span className="font-semibold">{email}</span>
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 p-4 rounded-lg mb-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <button
            onClick={handleResendVerification}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Resend Verification Email
          </button>
          <button
            onClick={() => auth.signOut()}
            className="text-blue-500 hover:text-blue-600"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
} 