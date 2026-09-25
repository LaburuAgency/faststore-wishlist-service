export interface WishlistDocument {
  id?: string
  shopperId: string
  productId: string
  skuId: string
  createdAt: string
}

export interface WishlistItem {
  productId: string
  skuId: string
  createdAt: string
}

export interface WishlistItemInput {
  productId: string
  skuId: string
}

export interface WishlistResponse {
  items: WishlistItem[]
  count: number
}

export interface WishlistCheckResponse {
  savedSkuIds: string[]
}

export interface AuthenticatedShopper {
  id: string
}
