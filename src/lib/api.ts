import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions'
import { app } from './firebase'

/**
 * Callable Functions client.
 *
 * All DB access now goes through authenticated Callable Functions. The
 * Firebase SDK automatically attaches the signed-in user's ID token; the
 * server verifies it before running any query.
 *
 * Set VITE_FUNCTIONS_EMULATOR=1 in local `.env` to route calls to the
 * Firebase Functions emulator on localhost:5001.
 */

const functions = getFunctions(app, 'us-central1')

if (import.meta.env.VITE_FUNCTIONS_EMULATOR === '1') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}

export function callable<TReq, TRes>(name: string) {
  const fn = httpsCallable<TReq, TRes>(functions, name)
  return async (data: TReq): Promise<TRes> => {
    const result = await fn(data)
    return result.data
  }
}
