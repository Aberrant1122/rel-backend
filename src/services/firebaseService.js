const admin = require('firebase-admin');

let db;

try {
    // Only initialize if not already initialized
    if (!admin.apps.length) {
        // Check if service account env var exists
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            
            const config = {
                credential: admin.credential.cert(serviceAccount)
            };
            
            // Add database URL if provided
            if (process.env.FIREBASE_DATABASE_URL) {
                config.databaseURL = process.env.FIREBASE_DATABASE_URL;
            }
            
            admin.initializeApp(config);
            console.log('🔥 Firebase Admin initialized successfully');
        } else {
            console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT environment variable not found. Firebase features will be disabled.');
        }
    }
    
    // Get Firestore instance if initialized
    if (admin.apps.length) {
        db = admin.firestore();
    }
} catch (error) {
    console.error('❌ Error initializing Firebase:', error.message);
}

module.exports = {
    admin,
    db,
    // Helper to check if firebase is ready
    isReady: () => !!db
};
