import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use initializeFirestore with experimentalForceLongPolling for better resilience 
// in environments that might have issues with long-lived WebSockets or gRPC streams.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId);

export const auth = getAuth();

async function testConnection() {
  try {
    // Only test if not in a server environment
    if (typeof window !== 'undefined') {
      // Use getDocFromServer to force a network check
      await getDocFromServer(doc(db, 'test', 'connection'));
      console.log("Firestore connection successful");
    }
  } catch (error: any) {
    // Code 14 is unavailable, which often means networking issues or blocked by firewall
    if(error.code === 'unavailable' || error.message?.includes('offline')) {
      console.error("Firestore connection issue detected (unavailable). The client will operate in offline mode.");
    } else {
      console.warn("Firestore connectivity check returned:", error.message);
    }
  }
}

testConnection();
