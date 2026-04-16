import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyCzJ1hwQYPzMrmakujkVDeexjGtxsjcLfA',
  authDomain: 'bjb-intake.firebaseapp.com',
  projectId: 'bjb-intake',
  storageBucket: 'bjb-intake.firebasestorage.app',
  messagingSenderId: '1024080628289',
  appId: '1:1024080628289:web:7a6c91e88351f6a4e994c0',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
