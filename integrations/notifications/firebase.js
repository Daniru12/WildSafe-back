const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let firebaseApp = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

    if (fs.existsSync(serviceAccountPath)) {
        try {
            const serviceAccount = require(serviceAccountPath);
            firebaseApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('[Firebase] App initialized successfully');
        } catch (err) {
            console.error('[Firebase] Error initializing Firebase Admin:', err.message);
        }
    } else {
        console.warn(`[Firebase] Service account file not found at ${serviceAccountPath}. Push notifications will be disabled.`);
    }
} else {
    console.warn('[Firebase] FIREBASE_SERVICE_ACCOUNT_JSON environment variable not set. Push notifications will be disabled.');
}

async function sendPush(token, title, body) {
    try {
        if (!firebaseApp) {
            console.warn('[Firebase] Push notification requested but Firebase Admin is not initialized.');
            return { status: 'skipped', message: 'Not initialized' };
        }

        const message = {
            notification: { title, body },
            token
        };

        const result = await firebaseApp.messaging().send(message);
        console.log(`[Firebase] Push sent to token: ${token.substring(0, 10)}... Result: ${result}`);
        return result;
    } catch (err) {
        console.error(`[Firebase] Error sending push to ${token.substring(0, 10)}...:`, err.message);
        throw err;
    }
}

module.exports = { sendPush };
