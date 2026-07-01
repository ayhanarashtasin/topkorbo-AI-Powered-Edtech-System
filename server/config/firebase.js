const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');

if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // The regex ensures that explicit \n strings are converted to actual newlines
        privateKey: process.env.FIREBASE_PRIVATE_KEY
          ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          : undefined,
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    console.log('Firebase Admin initialized');
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

const bucket = getStorage().bucket();
module.exports = { admin: require('firebase-admin/app'), bucket };
