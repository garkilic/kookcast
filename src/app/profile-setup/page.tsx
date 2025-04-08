'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function ProfileSetup() {
  const [surfLocation, setSurfLocation] = useState('');
  const [surferType, setSurferType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!auth.currentUser) {
      router.push('/');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!auth.currentUser) throw new Error('No user logged in');

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        surfLocation,
        surferType,
        updatedAt: new Date().toISOString(),
      });

      router.push('/dashboard');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">Complete Your Profile</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="surfLocation" className="block text-gray-700 mb-2">
              Where do you surf?
            </label>
            <input
              type="text"
              id="surfLocation"
              value={surfLocation}
              onChange={(e) => setSurfLocation(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="surferType" className="block text-gray-700 mb-2">
              Describe your surfer type
            </label>
            <textarea
              id="surferType"
              value={surferType}
              onChange={(e) => setSurferType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
} 