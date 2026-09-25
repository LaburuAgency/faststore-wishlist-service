import { createHash } from 'crypto'

import type {
  WishlistDocument,
  WishlistItem,
  WishlistItemInput,
} from '../types/wishlist'

const PAGE_SIZE = 100
const FIELDS: Array<keyof WishlistDocument> = [
  'id',
  'productId',
  'skuId',
  'createdAt',
]

interface WishlistSearchClient {
  search: (
    pagination: { page: number; pageSize: number },
    fields: Array<keyof WishlistDocument>,
    sort: string,
    where: string
  ) => Promise<WishlistDocument[]>
}

interface WishlistStorageClient extends WishlistSearchClient {
  saveOrUpdate: (document: WishlistDocument & { id: string }) => Promise<unknown>
  delete: (id: string) => Promise<unknown>
}

interface PaginationState {
  page: number
  documents: WishlistDocument[]
}

/**
 * One document per shopper + SKU. Deriving the Master Data id from that pair
 * makes adds idempotent: concurrent or repeated requests upsert the same
 * document instead of creating duplicates.
 */
export function getWishlistDocumentId(shopperId: string, skuId: string) {
  return createHash('sha256')
    .update(`${shopperId}:${skuId}`)
    .digest('hex')
    .slice(0, 32)
}

export async function listWishlistItems(
  client: WishlistSearchClient,
  shopperId: string
): Promise<WishlistItem[]> {
  return toItems(await listWishlistDocuments(client, shopperId))
}

export async function addWishlistItem(
  client: WishlistStorageClient,
  shopperId: string,
  { productId, skuId }: WishlistItemInput,
  now: Date = new Date()
): Promise<WishlistItem[]> {
  const items = await listWishlistItems(client, shopperId)

  if (items.some((item) => item.skuId === skuId)) {
    return items
  }

  const item: WishlistItem = { productId, skuId, createdAt: now.toISOString() }

  await client.saveOrUpdate({
    id: getWishlistDocumentId(shopperId, skuId),
    shopperId,
    ...item,
  })

  // Master Data search is eventually consistent, so the response is built
  // from the list we already have instead of searching again.
  return sortItems([item, ...items])
}

export async function removeWishlistItem(
  client: WishlistStorageClient,
  shopperId: string,
  skuId: string
): Promise<WishlistItem[]> {
  const documents = await listWishlistDocuments(client, shopperId)
  const matches = documents.filter((document) => document.skuId === skuId)
  const ids = new Set(
    matches
      .map(({ id }) => id)
      .filter((id): id is string => Boolean(id))
      .concat(getWishlistDocumentId(shopperId, skuId))
  )

  await Promise.all(
    Array.from(ids).map((id) => client.delete(id).catch(ignoreNotFound))
  )

  return toItems(documents.filter((document) => document.skuId !== skuId))
}

export async function checkWishlistItems(
  client: WishlistSearchClient,
  shopperId: string,
  skuIds: string[]
): Promise<string[]> {
  const saved = new Set(
    (await listWishlistItems(client, shopperId)).map(({ skuId }) => skuId)
  )

  return skuIds.filter((skuId) => saved.has(skuId))
}

async function listWishlistDocuments(
  client: WishlistSearchClient,
  shopperId: string
): Promise<WishlistDocument[]> {
  return loadWishlistPage(client, shopperId, { page: 1, documents: [] })
}

async function loadWishlistPage(
  client: WishlistSearchClient,
  shopperId: string,
  state: PaginationState
): Promise<WishlistDocument[]> {
  const page = await client.search(
    { page: state.page, pageSize: PAGE_SIZE },
    FIELDS,
    '',
    `shopperId=${shopperId}`
  )

  const documents = state.documents.concat(page)

  if (page.length < PAGE_SIZE) {
    return documents
  }

  return loadWishlistPage(client, shopperId, {
    page: state.page + 1,
    documents,
  })
}

function toItems(documents: WishlistDocument[]): WishlistItem[] {
  const seen = new Set<string>()
  const items = documents
    .filter(({ skuId }) => {
      if (seen.has(skuId)) {
        return false
      }

      seen.add(skuId)

      return true
    })
    .map(({ productId, skuId, createdAt }) => ({ productId, skuId, createdAt }))

  return sortItems(items)
}

function sortItems(items: WishlistItem[]): WishlistItem[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function ignoreNotFound(error: { response?: { status?: number } }) {
  if (error?.response?.status === 404) {
    return undefined
  }

  throw error
}
