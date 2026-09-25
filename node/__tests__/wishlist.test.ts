import { listWishlistItems } from '../services/wishlist'
import type { WishlistDocument } from '../types/wishlist'

describe('listWishlistItems', () => {
  it('queries only the authenticated shopper and hides internal fields', async () => {
    const search = jest.fn().mockResolvedValue([
      {
        id: 'internal-document-id',
        shopperId: 'shopper-a',
        productId: '10',
        skuId: '11',
        createdAt: '2026-09-25T12:00:00.000Z',
      },
    ])

    const items = await listWishlistItems({ search }, 'shopper-a')

    expect(search).toHaveBeenCalledWith(
      { page: 1, pageSize: 100 },
      ['id', 'productId', 'skuId', 'createdAt'],
      '',
      'shopperId=shopper-a'
    )
    expect(items).toEqual([
      {
        productId: '10',
        skuId: '11',
        createdAt: '2026-09-25T12:00:00.000Z',
      },
    ])
  })

  it('returns an empty list when the shopper has no favorites', async () => {
    const search = jest.fn().mockResolvedValue([])

    expect(await listWishlistItems({ search }, 'shopper-a')).toEqual([])
  })

  it('loads every page without exposing storage fields', async () => {
    const firstPage: WishlistDocument[] = Array.from(
      { length: 100 },
      (_, index) => ({
        id: `document-${index}`,
        shopperId: 'shopper-a',
        productId: `product-${index}`,
        skuId: `sku-${index}`,
        createdAt: '2026-09-25T12:00:00.000Z',
      })
    )

    const search = jest
      .fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([
        {
          shopperId: 'shopper-a',
          productId: 'product-100',
          skuId: 'sku-100',
          createdAt: '2026-09-25T12:01:00.000Z',
        },
      ])

    const items = await listWishlistItems({ search }, 'shopper-a')

    expect(items).toHaveLength(101)
    expect(search).toHaveBeenNthCalledWith(
      2,
      { page: 2, pageSize: 100 },
      ['id', 'productId', 'skuId', 'createdAt'],
      '',
      'shopperId=shopper-a'
    )
    expect(items[0]).not.toHaveProperty('shopperId')
    expect(items[0]).not.toHaveProperty('id')
  })

  it('propagates Master Data failures to the route boundary', async () => {
    const search = jest.fn().mockRejectedValue(new Error('Master Data failure'))

    await expect(listWishlistItems({ search }, 'shopper-a')).rejects.toThrow(
      'Master Data failure'
    )
  })
})
