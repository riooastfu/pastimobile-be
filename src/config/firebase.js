import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = join(__dirname, 'firebase-service-account.json');

if (!admin.apps.length) {
  if (!existsSync(serviceAccountPath)) {
    console.warn('Firebase service account file not found. Please download from Firebase Console.');
    console.warn('Path expected:', serviceAccountPath);
  } else {
    const serviceAccount = JSON.parse(
      readFileSync(serviceAccountPath, 'utf8')
    );
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    
    console.log('Firebase Admin initialized successfully');
  }
}

export default admin;