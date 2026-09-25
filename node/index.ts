import type { ClientsConfig, ServiceContext, RecorderState } from '@vtex/api'
import { method, Service } from '@vtex/api'

import { Clients } from './clients'
import { authenticateShopper } from './middlewares/authenticateShopper'
import { setPrivateNoStore } from './middlewares/setPrivateNoStore'
import {
  validateSkuList,
  validateSkuParam,
  validateWishlistItem,
} from './middlewares/validateWishlistItem'
import {
  addItem,
  checkItems,
  getWishlist,
  removeItem,
} from './middlewares/wishlistHandlers'
import type { AuthenticatedShopper, WishlistItemInput } from './types/wishlist'

const TIMEOUT_MS = 5000

const clients: ClientsConfig<Clients> = {
  implementation: Clients,
  options: {
    default: {
      retries: 2,
      timeout: TIMEOUT_MS,
    },
  },
}

declare global {
  type Context = ServiceContext<Clients, State>

  interface State extends RecorderState {
    shopper?: AuthenticatedShopper
    item?: WishlistItemInput
    skuId?: string
    skuIds?: string[]
  }
}

const authenticated = [setPrivateNoStore, authenticateShopper]

export default new Service({
  clients,
  routes: {
    wishlist: method({
      GET: [...authenticated, getWishlist],
    }),
    wishlistItems: method({
      POST: [...authenticated, validateWishlistItem, addItem],
    }),
    wishlistItem: method({
      DELETE: [...authenticated, validateSkuParam, removeItem],
    }),
    wishlistCheck: method({
      POST: [...authenticated, validateSkuList, checkItems],
    }),
  },
})
