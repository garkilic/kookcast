'use client';

import React, { useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

interface SurfDiaryEntryProps {
  initialData?: {
    rating: string;
    hadFun: boolean;
    description: string;
    date: string;
  };
  isEditMode?: boolean;
}

const SurfDiaryEntry: React.FC<SurfDiaryEntryProps> = ({ initialData, isEditMode = false }) => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    rating: initialData?.rating || 'killed_it',
    hadFun: initialData?.hadFun ?? true,
    description: initialData?.description || ''
  });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const ratingOptions = [
    { value: 'killed_it', label: 'I killed it! 🔥' },
    { value: 'ripped', label: 'Ripped it up! 🤙' },
    { value: 'decent', label: 'Pretty decent! 😎' },
    { value: 'struggled', label: 'Struggled a bit 😅' },
    { value: 'kooked', label: 'Total kook day 🤦‍♂️' }
  ];

  const handleCancel = () => {
    router.push('/dashboard-v2');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);

    if (!auth.currentUser) {
      setError('You must be logged in to save an entry');
      setIsSaving(false);
      return;
    }

    try {
      const today = initialData?.date || new Date().toISOString().split('T')[0];
      const userId = auth.currentUser.uid;
      console.log('Saving entry for user:', userId);
      
      const entryRef = doc(db, 'users', userId, 'surfEntries', today);
      console.log('Entry reference path:', entryRef.path);
      
      const entryData = {
        rating: formData.rating,
        hadFun: formData.hadFun,
        description: formData.description,
        date: today,
        timestamp: serverTimestamp()
      };

      console.log('Saving entry data:', entryData);
      await setDoc(entryRef, entryData);
      console.log('Entry saved successfully');
      
      router.push('/dashboard-v2');
    } catch (error) {
      console.error('Error saving entry:', error);
      setError(`Failed to save entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {isEditMode ? 'Edit Surf Diary Entry' : 'How was your surf session?'}
      </h2>
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-gray-700 mb-2">
            How did you surf?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ratingOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormData({ ...formData, rating: option.value })}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  formData.rating === option.value
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                disabled={isSaving}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-gray-700 mb-2">
            Did you have fun?
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, hadFun: true })}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                formData.hadFun
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              disabled={isSaving}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, hadFun: false })}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                !formData.hadFun
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              disabled={isSaving}
            >
              No
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-gray-700 mb-2">
            Describe your session
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Tell us about your surf session..."
            disabled={isSaving}
          />
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 border border-transparent rounded-lg text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : isEditMode ? 'Update Entry' : 'Save Entry'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SurfDiaryEntry; 