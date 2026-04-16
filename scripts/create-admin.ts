import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyCzJ1hwQYPzMrmakujkVDeexjGtxsjcLfA',
  authDomain: 'bjb-intake.firebaseapp.com',
  projectId: 'bjb-intake',
  storageBucket: 'bjb-intake.firebasestorage.app',
  messagingSenderId: '1024080628289',
  appId: '1:1024080628289:web:7a6c91e88351f6a4e994c0',
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

async function main() {
  try {
    const cred = await createUserWithEmailAndPassword(auth, 'admin@bjb.com', 'BJBadmin2026!')
    await updateProfile(cred.user, { displayName: 'Admin' })
    console.log('Admin account created:', cred.user.email)
    console.log('UID:', cred.user.uid)
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    if (e.code === 'auth/email-already-in-use') {
      console.log('Admin account already exists.')
    } else {
      console.error('Error:', e.message)
    }
  }
  process.exit(0)
}

main()
