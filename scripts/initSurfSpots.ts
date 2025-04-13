import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import { firebaseConfig } from '../src/lib/firebase';

const surfSpots = [
  { 
    id: 'ob', 
    name: "Ocean Beach - Kelly's Cove", 
    region: 'San Francisco',
    isPopular: true,
    description: 'Popular spot with consistent waves'
  },
  { 
    id: 'linda-mar', 
    name: 'Linda Mar - South Peak', 
    region: 'Pacifica',
    isPopular: true,
    description: 'Great beginner spot with regular waves'
  },
  { 
    id: 'montara', 
    name: 'Montara State Beach', 
    region: 'Half Moon Bay',
    isPopular: false,
    description: 'Less crowded with good morning conditions'
  },
  { 
    id: 'pleasure-point', 
    name: 'Pleasure Point', 
    region: 'Santa Cruz',
    isPopular: true,
    description: 'Iconic spot with reliable waves'
  },
  { 
    id: 'steamers', 
    name: 'Steamer Lane', 
    region: 'Santa Cruz',
    isPopular: true,
    description: 'World-famous right point break'
  },
  { 
    id: 'fort-point', 
    name: 'Fort Point', 
    region: 'San Francisco',
    isPopular: true,
    description: 'Historic spot under the Golden Gate'
  },
  { 
    id: 'rockaway', 
    name: 'Rockaway Beach', 
    region: 'Pacifica',
    isPopular: false,
    description: 'Consistent beach break'
  },
  { 
    id: 'princeton', 
    name: 'Princeton Jetty', 
    region: 'Half Moon Bay',
    isPopular: false,
    description: 'Popular spot near the harbor'
  },
];

async function initSurfSpots() {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    for (const spot of surfSpots) {
      await setDoc(doc(db, 'surfSpots', spot.id), spot);
      console.log(`Added spot: ${spot.name}`);
    }

    console.log('Successfully initialized surf spots!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing surf spots:', error);
    process.exit(1);
  }
}

initSurfSpots(); 