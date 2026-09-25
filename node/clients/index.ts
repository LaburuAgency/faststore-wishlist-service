import { IOClients } from '@vtex/api'
import { masterDataFor } from '@vtex/clients'

import type { WishlistDocument } from '../types/wishlist'
import { Catalog } from './catalog'

// Extend the default IOClients implementation with our own custom clients.
export class Clients extends IOClients {
  public get wishlist() {
    return this.getOrSet('wishlist', masterDataFor<WishlistDocument>('WLF'))
  }

  public get catalog() {
    return this.getOrSet('catalog', Catalog)
  }
}
