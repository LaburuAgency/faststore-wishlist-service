import { Readable } from 'stream'

import {
  validateSkuList,
  validateSkuParam,
  validateWishlistItem,
} from '../middlewares/validateWishlistItem'

const requestWithBody = (body: unknown) => {
  const req = Readable.from([JSON.stringify(body)]) as Readable & {
    headers: Record<string, string>
  }

  req.headers = { 'content-type': 'application/json' }

  return req
}

const context = (body: unknown, productIdBySku: string | null = '10') =>
  (({
    req: requestWithBody(body),
    state: {},
    clients: {
      catalog: {
        getProductIdBySku: jest.fn().mockResolvedValue(productIdBySku),
      },
    },
    vtex: { logger: { error: jest.fn() }, route: { params: {} } },
  } as unknown) as Context)

describe('validateWishlistItem', () => {
  it('accepts a SKU that belongs to the product', async () => {
    const ctx = context({ productId: '10', skuId: '11' })
    const next = jest.fn()

    await validateWishlistItem(ctx, next)

    expect(next).toHaveBeenCalled()
    expect(ctx.state.item).toEqual({ productId: '10', skuId: '11' })
  })

  it.each([
    [{ productId: '10' }],
    [{ productId: 'abc', skuId: '11' }],
    [{ productId: 10, skuId: 11 }],
  ])('rejects malformed input %p', async (body) => {
    const ctx = context(body)
    const next = jest.fn()

    await validateWishlistItem(ctx, next)

    expect(ctx.status).toBe(400)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects SKUs from another product', async () => {
    const ctx = context({ productId: '10', skuId: '11' }, '99')

    await validateWishlistItem(ctx, jest.fn())

    expect(ctx.status).toBe(400)
    expect(ctx.body).toMatchObject({ code: 'SKU_PRODUCT_MISMATCH' })
  })

  it('returns 404 for unknown SKUs', async () => {
    const ctx = context({ productId: '10', skuId: '11' }, null)

    await validateWishlistItem(ctx, jest.fn())

    expect(ctx.status).toBe(404)
  })
})

describe('validateSkuParam', () => {
  it('rejects non-numeric SKU route params', async () => {
    const ctx = context({})
    const next = jest.fn()

    ctx.vtex.route.params = { skuId: '../x' }
    await validateSkuParam(ctx, next)

    expect(ctx.status).toBe(400)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('validateSkuList', () => {
  it('dedupes valid SKU lists', async () => {
    const ctx = context({ skuIds: ['1', '1', '2'] })
    const next = jest.fn()

    await validateSkuList(ctx, next)

    expect(ctx.state.skuIds).toEqual(['1', '2'])
    expect(next).toHaveBeenCalled()
  })

  it('rejects oversized lists', async () => {
    const ctx = context({
      skuIds: Array.from({ length: 51 }, (_, i) => String(i)),
    })

    await validateSkuList(ctx, jest.fn())

    expect(ctx.status).toBe(400)
  })
})
