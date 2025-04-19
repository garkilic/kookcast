'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import SurfDiaryEntry from '@/components/SurfDiaryEntry';

interface SurfEntry {
  rating: string;
  hadFun: boolean;
  description: string;
  date: string;
  id: string;
}

export default function EditSurfDiaryEntry() {
  const params = useParams<{ date: string }>();
  const [entry, setEntry] = useState<SurfEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEntry = async () => {
      if (!auth.currentUser || !params?.date) {
        setError('You must be logged in to edit an entry');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching entry for date:', params.date);
        const userId = auth.currentUser.uid;
        const entryRef = doc(db, 'users', userId, 'surfEntries', params.date);
        const docSnap = await getDoc(entryRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as SurfEntry;
          console.log('Found entry:', data);
          setEntry({
            ...data,
            id: params.date
          });
        } else {
          console.log('No entry found for date:', params.date);
          setError('Entry not found');
        }
      } catch (error) {
        console.error('Error fetching entry:', error);
        setError('Failed to load entry');
      } finally {
        setLoading(false);
      }
    };

    fetchEntry();
  }, [params?.date]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-500">{error}</div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-500">Entry not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <SurfDiaryEntry initialData={entry} isEditMode={true} />
    </div>
  );
} 