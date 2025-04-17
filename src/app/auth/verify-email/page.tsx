'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { sendEmailVerification } from 'firebase/auth';
import { applyActionCode } from 'firebase/auth';
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
          router.push('/dashboard');
        }, 3000);
      } catch (err) {
        console.error('Error verifying email:', err);
        setError('Failed to verify email. Please try again.');
      }
    };

    verifyEmail();
  }, [oobCode, router]);

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Email Verification</h2>
          
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <p className="text-red-700">{error}</p>
              <Link href="/auth/signin" className="text-red-600 hover:text-red-800 font-medium mt-2 inline-block">
                Return to Sign In
              </Link>
            </div>
          ) : verified ? (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-green-700 mb-2">Your email has been verified successfully!</p>
              <p className="text-sm text-green-600">Redirecting to dashboard...</p>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-blue-700">Verifying your email...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 