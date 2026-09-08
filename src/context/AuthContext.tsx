import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { extractSurname, getEffectiveSurname } from '../utils/userHelper';
import {
  subscribeUserProfile,
  saveUserProfileToCloud,
  getUserProfileFromCloud,
} from '../services/firestoreService';

const CACHED_SURNAME_KEY = 'facility_cached_surname_v1';

interface AuthContextType {
  user: User | null;
  surname: string;
  customSurname: string;
  isAuthReady: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateSurname: (newSurname: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  surname: '',
  customSurname: '',
  isAuthReady: false,
  loginWithGoogle: async () => {},
  logout: async () => {},
  updateSurname: async () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 初期値として auth.currentUser およびキャッシュ済み苗字を同期的に参照
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [customSurname, setCustomSurname] = useState<string>(() => {
    try {
      return localStorage.getItem(CACHED_SURNAME_KEY) || '';
    } catch {
      return '';
    }
  });
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);

  // 1. Firebase onAuthStateChanged によるログイン状態の監視と自動復元
  useEffect(() => {
    // 確実な永続化設定（IndexedDB / LocalStorage）
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('Firebase setPersistence warning:', err);
    });

    // ページ再読み込み時に自動的に認証セッションとトークンを取得
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setUser(firebaseUser);
        setIsAuthReady(true);

        if (firebaseUser) {
          try {
            // Firestore上のカスタムプロフィール（苗字）を取得
            const profile = await getUserProfileFromCloud(firebaseUser.uid);
            if (profile && profile.surname) {
              setCustomSurname(profile.surname);
              try {
                localStorage.setItem(CACHED_SURNAME_KEY, profile.surname);
              } catch {}
            } else {
              // プロフィール未登録時は表示名から苗字を自動抽出して登録
              const extracted = extractSurname(firebaseUser.displayName);
              setCustomSurname(extracted);
              try {
                localStorage.setItem(CACHED_SURNAME_KEY, extracted);
              } catch {}
              await saveUserProfileToCloud({
                uid: firebaseUser.uid,
                surname: extracted,
                email: firebaseUser.email || '',
              });
            }
          } catch (e) {
            console.warn('User profile fetch error on auth restore:', e);
          }
        } else {
          // 未ログイン状態の確定
          setCustomSurname('');
          try {
            localStorage.removeItem(CACHED_SURNAME_KEY);
          } catch {}
        }
      },
      (error) => {
        console.error('onAuthStateChanged error:', error);
        setIsAuthReady(true);
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. ログインユーザーのカスタム苗字プロフィールのリアルタイム購読
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeUserProfile(user.uid, (profile) => {
      if (profile && profile.surname) {
        setCustomSurname(profile.surname);
        try {
          localStorage.setItem(CACHED_SURNAME_KEY, profile.surname);
        } catch {}
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // 有効な苗字の決定（カスタム姓 > Googleアカウント表示名から抽出した姓 > デフォルト）
  const surname = getEffectiveSurname(customSurname, user?.displayName);

  // Google ログイン実行
  const loginWithGoogle = async () => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        setUser(result.user);
        const extracted = extractSurname(result.user.displayName);
        const profile = await getUserProfileFromCloud(result.user.uid);
        if (profile && profile.surname) {
          setCustomSurname(profile.surname);
          try {
            localStorage.setItem(CACHED_SURNAME_KEY, profile.surname);
          } catch {}
        } else {
          setCustomSurname(extracted);
          try {
            localStorage.setItem(CACHED_SURNAME_KEY, extracted);
          } catch {}
          await saveUserProfileToCloud({
            uid: result.user.uid,
            surname: extracted,
            email: result.user.email || '',
          });
        }
      }
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      if (err.code === 'auth/popup-blocked') {
        alert('ポップアップがブロックされました。ブラウザのポップアップブロックを解除して再度お試しください。');
      } else if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        // ユーザーによるキャンセル
      } else {
        alert(`ログインに失敗しました: ${err.message || '通信エラー'}`);
      }
    }
  };

  // ログアウト実行
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setCustomSurname('');
      try {
        localStorage.removeItem(CACHED_SURNAME_KEY);
      } catch {}
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // 苗字の更新
  const updateSurname = async (newSurname: string) => {
    if (!user) return;
    const trimmed = newSurname.trim();
    if (!trimmed) return;

    setCustomSurname(trimmed);
    try {
      localStorage.setItem(CACHED_SURNAME_KEY, trimmed);
    } catch {}
    await saveUserProfileToCloud({
      uid: user.uid,
      surname: trimmed,
      email: user.email || '',
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        surname,
        customSurname,
        isAuthReady,
        loginWithGoogle,
        logout,
        updateSurname,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
