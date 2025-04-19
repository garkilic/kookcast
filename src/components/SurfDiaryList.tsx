import React, { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, collection, getDocs, orderBy, query, limit } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';

interface SurfEntry {
  date: string;
  rating: 'killed_it' | 'ripped' | 'decent' | 'struggled' | 'kook_day';
  hadFun: boolean;
  description?: string;
  id: string;
}

const SurfDiaryList: React.FC = () => {
  const [entries, setEntries] = useState<SurfEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEntries = async () => {
      if (!auth.currentUser) {
        console.log('No authenticated user found');
        return;
      }

      try {
        const userId = auth.currentUser.uid;
        console.log('Fetching entries for user:', userId);
        
        const userRef = doc(db, 'users', userId);
        const surfEntriesRef = collection(userRef, 'surfEntries');
        const q = query(surfEntriesRef, orderBy('timestamp', 'desc'), limit(10));
        
        console.log('Executing query...');
        const querySnapshot = await getDocs(q);
        console.log('Query completed, found documents:', querySnapshot.size);
        
        const fetchedEntries = querySnapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Processing document:', doc.id, data);
          return {
            ...data,
            date: doc.id
          } as SurfEntry;
        });
        
        console.log('Fetched entries:', fetchedEntries);
        setEntries(fetchedEntries);
      } catch (err) {
        console.error('Error loading entries:', err);
        setError(`Failed to load surf diary entries: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold mb-4">Recent Surf Diary Entries</h2>
      {entries.length === 0 ? (
        <p>No surf diary entries yet. <Link href="/surf-diary/new" className="text-blue-600 hover:underline">Create your first entry</Link></p>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.date} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold">
                  {format(parseISO(entry.date), 'MMMM d, yyyy')}
                </h3>
                <Link 
                  href={`/surf-diary/edit/${entry.date}`}
                  className="text-blue-600 hover:underline"
                >
                  Edit
                </Link>
              </div>
              
              <div className="mt-2">
                <p className="font-medium">
                  {entry.rating === 'killed_it' ? 'I killed it! 🔥' :
                   entry.rating === 'ripped' ? 'Ripped it up! 🤙' :
                   entry.rating === 'decent' ? 'Pretty decent! 😎' :
                   entry.rating === 'struggled' ? 'Struggled a bit 😅' :
                   'Total kook day 🤦‍♂️'}
                </p>
                
                <p className="mt-2">
                  {entry.hadFun ? 'Had a great time! 😊' : 'Not the best day... 😕'}
                </p>
                
                {entry.description && (
                  <div className="mt-2">
                    <p className="text-gray-600">{entry.description}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SurfDiaryList; 