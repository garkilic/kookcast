const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin with service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function migrateEmailVerification() {
  try {
    console.log('Starting email verification migration...');
    
    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      try {
        // Get user's auth record
        const userAuth = await auth.getUser(userDoc.id);
        
        // Check if Firestore needs to be updated
        if (userData.emailVerified !== userAuth.emailVerified) {
          console.log(`Updating user ${userDoc.id} - Auth emailVerified: ${userAuth.emailVerified}, Firestore emailVerified: ${userData.emailVerified}`);
          
          await db.doc(`users/${userDoc.id}`).update({
            emailVerified: userAuth.emailVerified,
            emailVerifiedAt: userAuth.emailVerified ? new Date().toISOString() : null
          });
          
          updatedCount++;
        } else {
          console.log(`Skipping user ${userDoc.id} - already in sync (${userData.emailVerified})`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`Error processing user ${userDoc.id}:`, error);
      }
    }
    
    console.log('\nMigration complete!');
    console.log(`Updated: ${updatedCount} users`);
    console.log(`Skipped: ${skippedCount} users`);
    
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    process.exit(0);
  }
}

migrateEmailVerification(); 