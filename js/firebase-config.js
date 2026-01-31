/**
 * Healthy Brains Initiative - Firebase Configuration
 */

// Firebase SDK imports (using CDN modules)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, updateDoc, query, orderBy, limit, onSnapshot, where } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

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
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Collection references
const pledgesCollection = collection(db, 'pledges');
const subscribersCollection = collection(db, 'subscribers');

/* ===========================
   AUTHENTICATION
   =========================== */

/**
 * Sign in with Google
 */
export async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        console.log('Signed in:', user.email);
        return {
            success: true,
            user: {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            }
        };
    } catch (error) {
        console.error('Google sign-in error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Sign out
 */
export async function signOutUser() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get current user
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

/**
 * Link a pledge to an authenticated user (for managing/rescinding later)
 */
export async function linkPledgeToUser(pledgeId, userId, userEmail) {
    try {
        const pledgeRef = doc(db, 'pledges', pledgeId);
        await updateDoc(pledgeRef, {
            userId: userId,
            userEmail: userEmail,
            linkedAt: new Date().toISOString()
        });
        console.log('Pledge linked to user:', pledgeId, userId);
        return { success: true };
    } catch (error) {
        console.error('Error linking pledge:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get user's pledges
 */
export async function getUserPledges(userId) {
    try {
        const q = query(pledgesCollection, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const pledges = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.userId === userId) {
                pledges.push({ id: doc.id, ...data });
            }
        });
        return pledges;
    } catch (error) {
        console.error('Error getting user pledges:', error);
        return [];
    }
}

/**
 * Rescind a pledge (mark as rescinded, don't delete)
 */
export async function rescindPledge(pledgeId, userId) {
    try {
        const pledgeRef = doc(db, 'pledges', pledgeId);
        const pledgeSnap = await getDoc(pledgeRef);

        if (!pledgeSnap.exists()) {
            return { success: false, error: 'Pledge not found' };
        }

        const pledgeData = pledgeSnap.data();
        if (pledgeData.userId !== userId) {
            return { success: false, error: 'Not authorized' };
        }

        await updateDoc(pledgeRef, {
            rescinded: true,
            rescindedAt: new Date().toISOString()
        });

        return { success: true };
    } catch (error) {
        console.error('Error rescinding pledge:', error);
        return { success: false, error: error.message };
    }
}

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
 * Note: We query public pledges to comply with Firestore security rules
 */
export async function getPledgeCount() {
    try {
        console.log('getPledgeCount: Starting query...');
        // Query public pledges (required by security rules)
        const q = query(pledgesCollection, where('isPublic', '==', true));
        console.log('getPledgeCount: Query created, fetching docs...');
        const snapshot = await getDocs(q);
        console.log('getPledgeCount: Got', snapshot.size, 'pledges');
        return snapshot.size;
    } catch (error) {
        console.error('getPledgeCount ERROR:', error);
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
 * Note: We query public pledges to comply with Firestore security rules
 */
export function subscribeToPledgeCount(callback) {
    // Query public pledges (required by security rules)
    const q = query(pledgesCollection, where('isPublic', '==', true));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.size);
    }, (error) => {
        console.error('Error subscribing to pledges:', error);
    });
}

/**
 * Save email subscriber to Firestore
 */
export async function saveEmailSubscriber(email, pledgeId = null) {
    try {
        const docRef = await addDoc(subscribersCollection, {
            email: email,
            pledgeId: pledgeId,
            source: 'website',
            subscribedAt: new Date().toISOString(),
            unsubscribed: false
        });
        console.log('Subscriber saved with ID:', docRef.id);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error saving subscriber:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Add email to an existing pledge
 */
export async function addEmailToPledge(pledgeId, email) {
    try {
        const pledgeRef = doc(db, 'pledges', pledgeId);
        await updateDoc(pledgeRef, {
            contactEmail: email,
            emailAddedAt: new Date().toISOString()
        });
        return { success: true };
    } catch (error) {
        console.error('Error adding email to pledge:', error);
        return { success: false, error: error.message };
    }
}

export { db, auth, pledgesCollection, subscribersCollection };
