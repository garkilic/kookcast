const admin = require('firebase-admin');
const fetch = require('node-fetch');
const xml2js = require('xml2js');

// Initialize Firebase Admin using default credentials
const app = admin.initializeApp({
  projectId: 'kookcast-f176d'
});

// List of surf spots with their coordinates and nearest tide stations
const surfSpots = [
  {
    id: 'venice-beach',
    name: 'Venice Beach',
    latitude: 33.9850,
    longitude: -118.4695,
    tideStation: '9410840' // Santa Monica
  },
  {
    id: 'malibu',
    name: 'Malibu',
    latitude: 34.0370,
    longitude: -118.6784,
    tideStation: '9410840' // Santa Monica
  },
  {
    id: 'topanga',
    name: 'Topanga',
    latitude: 34.0390,
    longitude: -118.6000,
    tideStation: '9410840' // Santa Monica
  },
  {
    id: 'sunset',
    name: 'Sunset Beach',
    latitude: 33.7167,
    longitude: -118.0683,
    tideStation: '9410840' // Santa Monica
  },
  {
    id: 'huntington-beach',
    name: 'Huntington Beach',
    latitude: 33.6558,
    longitude: -118.0050,
    tideStation: '9410660' // Los Angeles
  },
  {
    id: 'trestles',
    name: 'Trestles',
    latitude: 33.3847,
    longitude: -117.5900,
    tideStation: '9410660' // Los Angeles
  },
  {
    id: 'black-beach',
    name: 'Black Beach',
    latitude: 32.8750,
    longitude: -117.2533,
    tideStation: '9410230' // La Jolla
  },
  {
    id: 'ocean-beach',
    name: 'Ocean Beach',
    latitude: 32.7500,
    longitude: -117.2500,
    tideStation: '9410230' // La Jolla
  },
  {
    id: 'pacific-beach',
    name: 'Pacific Beach',
    latitude: 32.7958,
    longitude: -117.2542,
    tideStation: '9410230' // La Jolla
  },
  {
    id: 'la-jolla',
    name: 'La Jolla',
    latitude: 32.8500,
    longitude: -117.2700,
    tideStation: '9410230' // La Jolla
  }
];

// Function to find nearest NOAA tide station
async function findNearestTideStation(latitude, longitude) {
  try {
    const parser = new xml2js.Parser();
    const response = await fetch('https://www.ndbc.noaa.gov/activestations.xml');
    const text = await response.text();
    const result = await parser.parseStringPromise(text);
    
    const stations = result.stations.station;
    let nearestStation = null;
    let minDistance = Infinity;
    
    for (const station of stations) {
      const stationLat = parseFloat(station.lat[0]);
      const stationLon = parseFloat(station.lon[0]);
      
      // Calculate distance in kilometers
      const distance = calculateDistance(latitude, longitude, stationLat, stationLon);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestStation = station.id[0];
      }
    }
    
    return nearestStation;
  } catch (error) {
    console.error('Error finding nearest tide station:', error);
    return null;
  }
}

// Function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Main function to update surf spots
async function updateSurfSpots() {
  const db = admin.firestore();
  const batch = db.batch();
  
  for (const spot of surfSpots) {
    const spotRef = db.collection('surfSpots').doc(spot.id);
    
    // If no tide station is specified, find the nearest one
    if (!spot.tideStation) {
      spot.tideStation = await findNearestTideStation(spot.latitude, spot.longitude);
    }
    
    // Update the spot in Firestore
    batch.set(spotRef, {
      name: spot.name,
      latitude: spot.latitude,
      longitude: spot.longitude,
      tideStation: spot.tideStation,
      updatedAt: new Date()
    }, { merge: true });
    
    console.log(`Updated ${spot.name} with coordinates (${spot.latitude}, ${spot.longitude}) and tide station ${spot.tideStation}`);
  }
  
  // Commit the batch
  await batch.commit();
  console.log('All surf spots updated successfully!');
}

// Run the update
updateSurfSpots()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error updating surf spots:', error);
    process.exit(1);
  }); 