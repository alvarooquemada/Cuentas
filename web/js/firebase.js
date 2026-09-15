import { initializeApp } from "./vendor/firebase/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "./vendor/firebase/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from "./vendor/firebase/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Caché local persistente (IndexedDB): la app sigue funcionando sin
// conexión y sincroniza sola en cuanto vuelve a haber red.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
});

setPersistence(auth, browserLocalPersistence).catch(() => {});

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
};
