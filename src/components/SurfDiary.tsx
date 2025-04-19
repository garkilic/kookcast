import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, collection } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, parseISO } from 'date-fns';

interface SurfEntry {
  date: string;
  surfed: boolean;
  notes: string;
  conditions: {
    waveHeight: string;
    wind: string;
    tide: string;
  };
  boardUsed: string;
  rating: number;
}

const SurfDiary: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const dateParam = searchParams.get('date');
  
  const [entry, setEntry] = useState<SurfEntry>({
    date: dateParam || format(new Date(), 'yyyy-MM-dd'),
    surfed: false,
    notes: '',
    conditions: {
      waveHeight: '',
      wind: '',
      tide: '',
    },
    boardUsed: '',
    rating: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      if (!auth.currentUser) {
        navigate('/login');
        return;
      }
      
      // Try to load existing entry if it exists
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const surfEntriesRef = collection(userRef, 'surfEntries');
        const entryDoc = await getDoc(doc(surfEntriesRef, entry.date));
        
        if (entryDoc.exists()) {
          setEntry(entryDoc.data() as SurfEntry);
        }
      } catch (err) {
        console.error('Error loading existing entry:', err);
      }
      
      setLoading(false);
    };
    checkAuth();
  }, [navigate, entry.date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const surfEntriesRef = collection(userRef, 'surfEntries');
      
      await setDoc(doc(surfEntriesRef, entry.date), {
        ...entry,
        timestamp: new Date().toISOString(),
      });

      navigate('/profile');
    } catch (err) {
      setError('Failed to save surf entry. Please try again.');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">
        Surf Diary Entry for {format(parseISO(entry.date), 'MMMM d, yyyy')}
      </h1>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center space-x-4">
          <label className="text-lg">Did you surf today?</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="surfed"
                checked={entry.surfed}
                onChange={() => setEntry({ ...entry, surfed: true })}
                className="mr-2"
              />
              Yes
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="surfed"
                checked={!entry.surfed}
                onChange={() => setEntry({ ...entry, surfed: false })}
                className="mr-2"
              />
              No
            </label>
          </div>
        </div>

        {entry.surfed && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium">Wave Height</label>
                <input
                  type="text"
                  value={entry.conditions.waveHeight}
                  onChange={(e) => setEntry({
                    ...entry,
                    conditions: { ...entry.conditions, waveHeight: e.target.value }
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  placeholder="e.g., 2-3ft"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Wind</label>
                <input
                  type="text"
                  value={entry.conditions.wind}
                  onChange={(e) => setEntry({
                    ...entry,
                    conditions: { ...entry.conditions, wind: e.target.value }
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  placeholder="e.g., Light offshore"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Tide</label>
                <input
                  type="text"
                  value={entry.conditions.tide}
                  onChange={(e) => setEntry({
                    ...entry,
                    conditions: { ...entry.conditions, tide: e.target.value }
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  placeholder="e.g., High tide"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Board Used</label>
              <input
                type="text"
                value={entry.boardUsed}
                onChange={(e) => setEntry({ ...entry, boardUsed: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                placeholder="e.g., 6'0 Shortboard"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Rating (1-5)</label>
              <input
                type="number"
                min="1"
                max="5"
                value={entry.rating}
                onChange={(e) => setEntry({ ...entry, rating: parseInt(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium">Notes</label>
          <textarea
            value={entry.notes}
            onChange={(e) => setEntry({ ...entry, notes: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            rows={4}
            placeholder="How was your session? What did you work on?"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Save Entry
        </button>
      </form>
    </div>
  );
};

export default SurfDiary; 