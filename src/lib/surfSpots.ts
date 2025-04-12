import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export type SurfSpot = {
  id: string;
  name: string;
  region: string;
  isPopular: boolean;
  description: string;
};

export async function getSurfSpots(): Promise<SurfSpot[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'surfSpots'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SurfSpot[];
  } catch (error) {
    console.error('Error fetching surf spots:', error);
    return [];
  }
} 