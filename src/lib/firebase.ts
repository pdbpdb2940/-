import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  Auth,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import firebaseConfigJson from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 指定の databaseId があればそれを渡し、なければデフォルト
export const db: Firestore = firebaseConfigJson.firestoreDatabaseId
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(app);

export const auth: Auth = getAuth(app);

// ブラウザ再読み込み時にもログインセッションを確実に維持するため永続性を明示設定
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Firebase setPersistence warning:', err);
});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { app };


