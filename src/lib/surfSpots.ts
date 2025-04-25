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
  console.log('getSurfSpots: Starting to fetch spots');
  try {
    const surfSpotsRef = collection(db, 'surfSpots');
    console.log('getSurfSpots: Collection reference created');
    
    const querySnapshot = await getDocs(surfSpotsRef);
    console.log('getSurfSpots: Got query snapshot, size:', querySnapshot.size);
    
    if (querySnapshot.empty) {
      console.log('getSurfSpots: No spots found in collection');
      return [];
    }

    const spots = querySnapshot.docs.map(doc => {
      const data = doc.data();
      console.log('getSurfSpots: Processing spot:', doc.id, data);
      return {
        id: doc.id,
        ...data
      };
    }) as SurfSpot[];
    
    console.log('getSurfSpots: Processed spots:', spots.length);
    
    // Sort spots by popularity (isMostPopular) and then alphabetically
    const sortedSpots = spots.sort((a, b) => {
      if (a.isMostPopular && !b.isMostPopular) return -1;
      if (!a.isMostPopular && b.isMostPopular) return 1;
      return a.name.localeCompare(b.name);
    });
    
    console.log('getSurfSpots: Returning sorted spots');
    return sortedSpots;
  } catch (error) {
    console.error('getSurfSpots: Error fetching surf spots:', error);
    return [];
  }
} 