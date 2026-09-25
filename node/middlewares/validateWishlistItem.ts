import { json } from 'co-body'

import type { WishlistItemInput } from '../types/wishlist'

const CATALOG_ID_PATTERN = /^\d{1,20}$/

export const MAX_CHECK_SKUS = 50

export function isCatalogId(value: unknown): value is string {
  return typeof value === 'string' && CATALOG_ID_PATTERN.test(value)
}

function reject(ctx: Context, status: number, code: string, message: string) {
  ctx.status = status
  ctx.body = { code, message }
}

async function readBody(ctx: Context): Promise<Record<string, unknown>> {
  try {
    const body = await json(ctx.req)

    return body && typeof body === 'object' ? body : {}
  } catch {
    return {}
  }
}

/**
 * Validates `{ productId, skuId }` and confirms against the catalog that the
 * SKU exists and belongs to that product before anything is persisted.
 */
export async function validateWishlistItem(
  ctx: Context,
  next: () => Promise<unknown>
) {
  const { productId, skuId } = await readBody(ctx)

  if (!isCatalogId(productId) || !isCatalogId(skuId)) {
    reject(ctx, 400, 'INVALID_ITEM', 'productId and skuId must be catalog ids')

    return
  }

  let ownerProductId: string | null

  try {
    ownerProductId = await ctx.clients.catalog.getProductIdBySku(skuId)
  } catch (error) {
    ctx.vtex.logger.error({
      message: 'Unable to validate wishlist SKU against the catalog',
      error,
    })
    reject(ctx, 502, 'CATALOG_UNAVAILABLE', 'Unable to validate product')

    return
  }

  if (!ownerProductId) {
    reject(ctx, 404, 'SKU_NOT_FOUND', 'SKU not found')

    return
  }

  if (ownerProductId !== productId) {
    reject(ctx, 400, 'SKU_PRODUCT_MISMATCH', 'SKU does not belong to product')

    return
  }

  const item: WishlistItemInput = { productId, skuId }

  ctx.state.item = item
  await next()
}

export async function validateSkuParam(
  ctx: Context,
  next: () => Promise<unknown>
) {
  const { skuId } = ctx.vtex.route.params

  if (!isCatalogId(skuId)) {
    reject(ctx, 400, 'INVALID_SKU', 'skuId must be a catalog id')

    return
  }

  ctx.state.skuId = skuId
  await next()
}

export async function validateSkuList(
  ctx: Context,
  next: () => Promise<unknown>
) {
  const { skuIds } = await readBody(ctx)

  if (
    !Array.isArray(skuIds) ||
    skuIds.length > MAX_CHECK_SKUS ||
    !skuIds.every(isCatalogId)
  ) {
    reject(
      ctx,
      400,
      'INVALID_SKUS',
      `skuIds must be an array of up to ${MAX_CHECK_SKUS} catalog ids`
    )

    return
  }

  ctx.state.skuIds = Array.from(new Set(skuIds))
  await next()
}
