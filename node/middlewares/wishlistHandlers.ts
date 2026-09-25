import {
  addWishlistItem,
  checkWishlistItems,
  listWishlistItems,
  removeWishlistItem,
} from '../services/wishlist'
import type {
  WishlistCheckResponse,
  WishlistItem,
  WishlistResponse,
} from '../types/wishlist'

const UNAUTHENTICATED_RESPONSE = {
  code: 'UNAUTHENTICATED',
  message: 'Authentication required',
}

type Operation = (shopperId: string) => Promise<unknown>

/**
 * Shared boundary for every wishlist route: requires the shopper resolved by
 * `authenticateShopper` and turns storage failures into a generic 500 so
 * Master Data details never reach the client.
 */
async function runForShopper(
  ctx: Context,
  failureMessage: string,
  operation: Operation
) {
  const shopperId = ctx.state.shopper?.id

  if (!shopperId) {
    ctx.status = 401
    ctx.body = UNAUTHENTICATED_RESPONSE

    return
  }

  try {
    ctx.body = await operation(shopperId)
    ctx.status = 200
  } catch (error) {
    ctx.vtex.logger.error({ message: failureMessage, error })

    ctx.status = 500
    ctx.body = {
      code: 'WISHLIST_UNAVAILABLE',
      message: 'Unable to load wishlist',
    }
  }
}

const toResponse = (items: WishlistItem[]): WishlistResponse => ({
  items,
  count: items.length,
})

export const getWishlist = (ctx: Context) =>
  runForShopper(ctx, 'Unable to load wishlist from Master Data', async (id) =>
    toResponse(await listWishlistItems(ctx.clients.wishlist, id))
  )

export const addItem = (ctx: Context) =>
  runForShopper(ctx, 'Unable to add wishlist item', async (id) =>
    toResponse(await addWishlistItem(ctx.clients.wishlist, id, ctx.state.item!))
  )

export const removeItem = (ctx: Context) =>
  runForShopper(ctx, 'Unable to remove wishlist item', async (id) =>
    toResponse(
      await removeWishlistItem(ctx.clients.wishlist, id, ctx.state.skuId!)
    )
  )

export const checkItems = (ctx: Context) =>
  runForShopper(
    ctx,
    'Unable to check wishlist items',
    async (id): Promise<WishlistCheckResponse> => ({
      savedSkuIds: await checkWishlistItems(
        ctx.clients.wishlist,
        id,
        ctx.state.skuIds ?? []
      ),
    })
  )
