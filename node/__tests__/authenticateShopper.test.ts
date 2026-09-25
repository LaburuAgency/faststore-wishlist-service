import {
  getAuthenticatedShopperId,
  getSessionToken,
} from '../middlewares/authenticateShopper'

describe('getSessionToken', () => {
  it('extracts the VTEX session token without exposing other cookies', () => {
    expect(
      getSessionToken('foo=bar; vtex_session=session-token; baz=qux')
    ).toBe('session-token')
  })

  it('returns null when the private session cookie is absent', () => {
    expect(getSessionToken('foo=bar')).toBeNull()
  })
})

describe('getAuthenticatedShopperId', () => {
  it('returns the authenticated store user id', () => {
    expect(
      getAuthenticatedShopperId({
        namespaces: {
          authentication: {
            storeUserId: { value: 'shopper-a' },
          },
          profile: {
            isAuthenticated: { value: true },
          },
        },
      })
    ).toBe('shopper-a')
  })

  it('rejects anonymous sessions', () => {
    expect(
      getAuthenticatedShopperId({
        namespaces: {
          profile: {
            isAuthenticated: { value: false },
          },
        },
      })
    ).toBeNull()
  })

  it('rejects sessions without a store user id', () => {
    expect(
      getAuthenticatedShopperId({
        namespaces: {
          profile: {
            isAuthenticated: { value: true },
          },
        },
      })
    ).toBeNull()
  })
})
