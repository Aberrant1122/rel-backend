const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
    if (!/already exists/.test(error.message)) {
        console.error('Firebase initialization error', error.stack);
    }
}

const db = admin.firestore();

module.exports = { admin, db };
