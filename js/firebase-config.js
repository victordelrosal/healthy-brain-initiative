/**
 * Healthy Brains Initiative - Firebase Configuration
 */

// Firebase SDK imports (using CDN modules)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBatckVrga0EnxU0I_8ub5P7fEskkfoAo4",
    authDomain: "healthy-brains-initiative.firebaseapp.com",
    projectId: "healthy-brains-initiative",
    storageBucket: "healthy-brains-initiative.firebasestorage.app",
    messagingSenderId: "999013544034",
    appId: "1:999013544034:web:2d8dca3c9b5d0f120ca13b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Collection reference
const pledgesCollection = collection(db, 'pledges');

/**
 * Save a pledge to Firestore
 */
export async function savePledgeToFirebase(pledgeData) {
    try {
        const docRef = await addDoc(pledgesCollection, {
            ...pledgeData,
            createdAt: new Date().toISOString()
        });
        console.log('Pledge saved with ID:', docRef.id);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error saving pledge:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get total pledge count from Firestore
 */
export async function getPledgeCount() {
    try {
        const snapshot = await getDocs(pledgesCollection);
        return snapshot.size;
    } catch (error) {
        console.error('Error getting pledge count:', error);
        return 0;
    }
}

/**
 * Get recent public pledges (for displaying names)
 */
export async function getPublicPledges(limitCount = 10) {
    try {
        const q = query(pledgesCollection, orderBy('createdAt', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);
        const pledges = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.isPublic) {
                pledges.push({
                    id: doc.id,
                    displayName: data.displayName,
                    childClass: data.childClass,
                    createdAt: data.createdAt
                });
            }
        });
        return pledges;
    } catch (error) {
        console.error('Error getting pledges:', error);
        return [];
    }
}

/**
 * Subscribe to real-time pledge count updates
 */
export function subscribeToPledgeCount(callback) {
    return onSnapshot(pledgesCollection, (snapshot) => {
        callback(snapshot.size);
    }, (error) => {
        console.error('Error subscribing to pledges:', error);
    });
}

export { db, pledgesCollection };
