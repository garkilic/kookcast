import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { getSurfSpots, SurfSpot } from '@/lib/surfSpots';

interface UserData {
  id: string;
  email: string;
  surfLocations: string[];
  surferPreferences: {
    description: string;
    boardTypes: string[];
  };
  emailVerified: boolean;
  premium: boolean;
  createdAt: string;
  updatedAt: string;
}

const defaultUserData: UserData = {
  id: '',
  email: '',
  surfLocations: [],
  surferPreferences: {
    description: '',
    boardTypes: []
  },
  emailVerified: false,
  premium: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export default function useUserProfile() {
  const [userData, setUserData] = useState<UserData>(defaultUserData);
  const [surfSpots, setSurfSpots] = useState<SurfSpot[]>([]);
  const [allSpots, setAllSpots] = useState<SurfSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('useUserProfile: Starting effect');
    const auth = getAuth();
    const db = getFirestore();

    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('useUserProfile: Auth state changed', { user: user?.uid });

      if (!user) {
        console.log('useUserProfile: No user found');
        setUserData(defaultUserData);
        setSurfSpots([]);
        setLoading(false);
        return;
      }

      // Real-time listener to user document
      console.log('useUserProfile: Setting up Firestore listener for', user.uid);
      const userRef = doc(db, 'users', user.uid);
      const unsubscribeSnapshot = onSnapshot(userRef, async (userDoc) => {
        console.log('useUserProfile: Firestore snapshot received', userDoc.exists());

        if (userDoc.exists()) {
          const data = userDoc.data();
          console.log('useUserProfile: User data updated', data);
          setUserData({
            id: user.uid,
            email: user.email || '',
            surfLocations: data.surfLocations || [],
            surferPreferences: {
              description: data.surferPreferences?.description || '',
              boardTypes: data.surferPreferences?.boardTypes || []
            },
            emailVerified: data.emailVerified || false,
            premium: data.premium || false,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString()
          });

          // Fetch surf spots only once if not already fetched
          console.log('useUserProfile: Fetching surf spots');
          const spots = await getSurfSpots();
          setAllSpots(spots);

          const userSpots = spots.filter(spot =>
            (data.surfLocations || []).includes(spot.id)
          );
          console.log('useUserProfile: Filtered user spots', userSpots.length);
          setSurfSpots(userSpots);
        } else {
          console.log('useUserProfile: No user document found');
          setUserData(defaultUserData);
          setSurfSpots([]);
        }
        setLoading(false);
      }, (err) => {
        console.error('useUserProfile: Error with Firestore snapshot:', err);
        setError(err.message);
        setLoading(false);
      });

      // Cleanup both auth listener and snapshot listener
      return () => {
        console.log('useUserProfile: Cleaning up listeners');
        unsubscribe();
        unsubscribeSnapshot();
      };
    });

    // Cleanup subscription
    return () => {
      console.log('useUserProfile: Cleaning up');
      unsubscribe();
    };
  }, []);

  return {
    userData,
    surfSpots,
    allSpots,
    loading,
    error
  };
} 