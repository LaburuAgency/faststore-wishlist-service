import { authenticateShopper } from '../middlewares/authenticateShopper'
import { getWishlist } from '../middlewares/wishlistHandlers'
import { setPrivateNoStore } from '../middlewares/setPrivateNoStore'

describe('wishlist HTTP middlewares', () => {
  it('returns 401 when the VTEX session cookie is absent', async () => {
    const next = jest.fn()
    const ctx = {
      request: { headers: {} },
    } as Context

    await authenticateShopper(ctx, next)

    expect(ctx.status).toBe(401)
    expect(ctx.body).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('marks every response as private and non-cacheable', async () => {
    const next = jest.fn().mockResolvedValue(undefined)
    const set = jest.fn()
    const ctx = ({ set } as unknown) as Context

    await setPrivateNoStore(ctx, next)

    expect(set).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('returns an empty wishlist response for an authenticated shopper', async () => {
    const ctx = ({
      state: { shopper: { id: 'shopper-a' } },
      clients: {
        wishlist: {
          search: jest.fn().mockResolvedValue([]),
        },
      },
      vtex: { logger: { error: jest.fn() } },
    } as unknown) as Context

    await getWishlist(ctx)

    expect(ctx.status).toBe(200)
    expect(ctx.body).toEqual({ items: [], count: 0 })
  })

  it('returns a generic response when Master Data fails', async () => {
    const error = jest.fn()
    const ctx = ({
      state: { shopper: { id: 'shopper-a' } },
      clients: {
        wishlist: {
          search: jest.fn().mockRejectedValue(new Error('sensitive details')),
        },
      },
      vtex: { logger: { error } },
    } as unknown) as Context

    await getWishlist(ctx)

    expect(ctx.status).toBe(500)
    expect(ctx.body).toEqual({
      code: 'WISHLIST_UNAVAILABLE',
      message: 'Unable to load wishlist',
    })
    expect(JSON.stringify(ctx.body)).not.toContain('sensitive details')
    expect(error).toHaveBeenCalledTimes(1)
  })
})
