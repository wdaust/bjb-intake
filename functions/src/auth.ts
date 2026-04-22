import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'

/**
 * Require a signed-in Firebase user. Returns the auth context or throws
 * an `unauthenticated` HttpsError that Callable clients receive as a
 * permission-denied response.
 *
 * Today any authenticated user can call any handler. Add per-endpoint
 * role checks here (e.g. custom claims) as the authz model evolves.
 */
export function requireAuth(request: CallableRequest<unknown>) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign-in required')
  }
  return request.auth
}
