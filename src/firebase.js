import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'

// These values come from your Firebase project settings.
// Create a file named `.env` in the project root (see .env.example)
// and Vite will load them automatically.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)

// App Check (needed for Firebase AI Logic). Skipped if no site key is set,
// so the app still runs without it.
const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
if (siteKey) {
  // On localhost the browser console prints a debug token. Register it in
  // Firebase console -> App Check -> Apps -> Manage debug tokens.
  if (location.hostname === 'localhost') {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  })
}

export const db = getFirestore(app)
