'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { applyActionCode, sendEmailVerification } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function VerifyEmail() {
  const [email, setEmail] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Get oobCode from URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get('oobCode');
    setOobCode(code);

    const currentUser = auth.currentUser;
    if (currentUser) {
      setEmail(currentUser.email || '');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!oobCode) {
        setError('No verification code found in URL');
        return;
      }

      try {
        await applyActionCode(auth, oobCode);
        setVerified(true);

        // Reload the current user to get updated email verification status
        const currentUser = auth.currentUser;
        if (currentUser) {
          await currentUser.reload();
          
          // Update Firestore if email is verified
          if (currentUser.emailVerified) {
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
              emailVerified: true,
              emailVerifiedAt: new Date().toISOString()
            });
          }
        }

        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          router.push('/dashboard-v2');
        }, 3000);
      } catch (err: any) {
        console.error('Error verifying email:', err);
        if (err.code === 'auth/invalid-action-code') {
          setError('This verification link has expired or is invalid. Please request a new one.');
        } else if (err.code === 'auth/expired-action-code') {
          setError('This verification link has expired. Please request a new one.');
        } else {
          setError('Failed to verify email. Please try again.');
        }
      }
    };

    if (oobCode) {
      verifyEmail();
    }
  }, [oobCode, router]);

  const handleResendVerification = async () => {
    if (!auth.currentUser) {
      setError('Please sign in to resend verification email');
      return;
    }

    try {
      await sendEmailVerification(auth.currentUser, {
        url: `${window.location.origin}/auth/verify-email`,
        handleCodeInApp: true
      });
      setVerificationSent(true);
      setError('');
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      setError('Failed to send verification email. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Email Verification</h2>
          
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <p className="text-red-700">{error}</p>
              {error.includes('expired') || error.includes('invalid') ? (
                <button
                  onClick={handleResendVerification}
                  className="mt-2 text-red-600 hover:text-red-800 font-medium"
                >
                  Resend Verification Email
                </button>
              ) : (
                <Link href="/auth/signin" className="text-red-600 hover:text-red-800 font-medium mt-2 inline-block">
                  Return to Sign In
                </Link>
              )}
            </div>
          ) : verified ? (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-green-700 mb-2">Your email has been verified successfully!</p>
              <p className="text-sm text-green-600">Redirecting to dashboard...</p>
            </div>
          ) : verificationSent ? (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-blue-700">Verification email sent! Please check your inbox.</p>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-yellow-700">Please verify your email address to continue.</p>
              <button
                onClick={handleResendVerification}
                className="mt-2 text-yellow-600 hover:text-yellow-800 font-medium"
              >
                Resend Verification Email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 