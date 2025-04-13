import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export type SurfSpot = {
  id: string;
  name: string;
  region: string;
  isPopular: boolean;
  description: string;
  isMostPopular: boolean;
};

export async function getSurfSpots(): Promise<SurfSpot[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'surfSpots'));
    const spots = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SurfSpot[];
    
    // Sort spots by popularity (isMostPopular) and then alphabetically
    return spots.sort((a, b) => {
      if (a.isMostPopular && !b.isMostPopular) return -1;
      if (!a.isMostPopular && b.isMostPopular) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error('Error fetching surf spots:', error);
    return [];
  }
} 