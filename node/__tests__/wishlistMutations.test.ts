import {
  addWishlistItem,
  checkWishlistItems,
  getWishlistDocumentId,
  removeWishlistItem,
} from '../services/wishlist'

const existing = {
  id: 'doc-1',
  shopperId: 'shopper-a',
  productId: '10',
  skuId: '11',
  createdAt: '2026-09-25T12:00:00.000Z',
}

const storage = (documents = [existing]) => ({
  search: jest.fn().mockResolvedValue(documents),
  saveOrUpdate: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({}),
})

describe('getWishlistDocumentId', () => {
  it('is stable per shopper and SKU', () => {
    expect(getWishlistDocumentId('a', '1')).toBe(getWishlistDocumentId('a', '1'))
    expect(getWishlistDocumentId('a', '1')).not.toBe(
      getWishlistDocumentId('b', '1')
    )
    expect(getWishlistDocumentId('a', '1')).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('addWishlistItem', () => {
  it('upserts a deterministic document and returns the merged list', async () => {
    const client = storage()
    const now = new Date('2026-09-25T13:00:00.000Z')

    const items = await addWishlistItem(
      client,
      'shopper-a',
      { productId: '20', skuId: '21' },
      now
    )

    expect(client.saveOrUpdate).toHaveBeenCalledWith({
      id: getWishlistDocumentId('shopper-a', '21'),
      shopperId: 'shopper-a',
      productId: '20',
      skuId: '21',
      createdAt: now.toISOString(),
    })
    expect(items.map(({ skuId }) => skuId)).toEqual(['21', '11'])
  })

  it('does not write when the SKU is already saved', async () => {
    const client = storage()

    const items = await addWishlistItem(client, 'shopper-a', {
      productId: '10',
      skuId: '11',
    })

    expect(client.saveOrUpdate).not.toHaveBeenCalled()
    expect(items).toHaveLength(1)
  })
})

describe('removeWishlistItem', () => {
  it('deletes the stored and deterministic ids and ignores 404s', async () => {
    const client = storage()

    client.delete.mockRejectedValueOnce({ response: { status: 404 } })

    const items = await removeWishlistItem(client, 'shopper-a', '11')

    expect(client.delete).toHaveBeenCalledWith('doc-1')
    expect(client.delete).toHaveBeenCalledWith(
      getWishlistDocumentId('shopper-a', '11')
    )
    expect(items).toEqual([])
  })

  it('propagates non-404 storage failures', async () => {
    const client = storage()

    client.delete.mockRejectedValue({ response: { status: 500 } })

    await expect(
      removeWishlistItem(client, 'shopper-a', '11')
    ).rejects.toEqual({ response: { status: 500 } })
  })
})

describe('checkWishlistItems', () => {
  it('returns only the requested SKUs that are saved', async () => {
    expect(
      await checkWishlistItems(storage(), 'shopper-a', ['11', '99'])
    ).toEqual(['11'])
  })
})
