import type { SessionResponse } from '../types/session'

const UNAUTHENTICATED_RESPONSE = {
  code: 'UNAUTHENTICATED',
  message: 'Authentication required',
}

const SESSION_ITEMS = ['authentication.storeUserId', 'profile.isAuthenticated']

export function getSessionToken(cookieHeader?: string): string | null {
  if (!cookieHeader) {
    return null
  }

  const sessionCookie = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('vtex_session='))

  const sessionToken = sessionCookie?.slice('vtex_session='.length)

  if (!sessionToken) {
    return null
  }

  return sessionToken
}

export function getAuthenticatedShopperId(
  session: SessionResponse
): string | null {
  const authentication = session.namespaces?.authentication
  const profile = session.namespaces?.profile
  const shopperId = authentication?.storeUserId?.value
  const isAuthenticated = profile?.isAuthenticated?.value

  if (String(isAuthenticated) !== 'true' || !shopperId) {
    return null
  }

  return shopperId
}

export async function authenticateShopper(
  ctx: Context,
  next: () => Promise<unknown>
) {
  const sessionToken = getSessionToken(ctx.request.headers.cookie)

  if (!sessionToken) {
    ctx.status = 401
    ctx.body = UNAUTHENTICATED_RESPONSE

    return
  }

  try {
    const { sessionData } = await ctx.clients.session.getSession(
      sessionToken,
      SESSION_ITEMS
    )

    const shopperId = getAuthenticatedShopperId(sessionData)

    if (!shopperId) {
      ctx.status = 401
      ctx.body = UNAUTHENTICATED_RESPONSE

      return
    }

    ctx.state.shopper = { id: shopperId }
    await next()
  } catch (error) {
    ctx.vtex.logger.warn({
      message: 'Unable to authenticate wishlist shopper',
      error,
    })

    ctx.status = 401
    ctx.body = UNAUTHENTICATED_RESPONSE
  }
}
