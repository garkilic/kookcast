import axios from 'axios';

async function runMigration() {
  try {
    const response = await axios.get('https://us-central1-kookcast-f176d.cloudfunctions.net/migrateSurfLocations');
    console.log('Migration completed successfully:', response.data);
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

runMigration(); 