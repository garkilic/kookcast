import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getSurfSpots, SurfSpot } from '@/lib/surfSpots';

interface UserData {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  surfLocations: string[];
  updatedAt: string;
  surferType: string;
  emailVerified: boolean;
  premium: boolean;
  homeBreak?: string;
  boardTypes: string[];
  createdAt: string;
}

const defaultUserData: UserData = {
  id: '',
  email: '',
  displayName: '',
  photoURL: '',
  surfLocations: [],
  updatedAt: new Date().toISOString(),
  surferType: 'intermediate',
  emailVerified: false,
  premium: false,
  boardTypes: [],
  createdAt: new Date().toISOString()
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
      try {
        if (!user) {
          console.log('useUserProfile: No user found');
          setUserData(defaultUserData);
          setSurfSpots([]);
          setLoading(false);
          return;
        }

        // Fetch user data
        console.log('useUserProfile: Fetching user data for', user.uid);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        console.log('useUserProfile: User doc exists?', userDoc.exists());
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          console.log('useUserProfile: User data fetched', data);
          setUserData({
            id: user.uid,
            email: user.email || '',
            displayName: data.displayName || '',
            photoURL: data.photoURL || '',
            surfLocations: data.surfLocations || [],
            updatedAt: data.updatedAt || new Date().toISOString(),
            surferType: data.surferType || 'intermediate',
            emailVerified: data.emailVerified || false,
            premium: data.premium || false,
            homeBreak: data.homeBreak,
            boardTypes: data.boardTypes || [],
            createdAt: data.createdAt || new Date().toISOString()
          });
        } else {
          console.log('useUserProfile: No user document found');
          setUserData(defaultUserData);
        }

        // Fetch all surf spots
        console.log('useUserProfile: Fetching surf spots');
        const spots = await getSurfSpots();
        console.log('useUserProfile: Surf spots fetched', spots.length);
        setAllSpots(spots);

        // Filter spots based on user's locations
        if (userDoc.exists()) {
          const data = userDoc.data();
          const userSpots = spots.filter(spot => 
            (data.surfLocations || []).includes(spot.id)
          );
          console.log('useUserProfile: Filtered user spots', userSpots.length);
          setSurfSpots(userSpots);
        } else {
          setSurfSpots([]);
        }
      } catch (err: any) {
        console.error('useUserProfile: Error fetching user profile:', err);
        setError(err.message);
        setUserData(defaultUserData);
      } finally {
        console.log('useUserProfile: Setting loading to false');
        setLoading(false);
      }
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