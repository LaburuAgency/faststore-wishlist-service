import type { InstanceOptions, IOContext } from '@vtex/api'
import { JanusClient } from '@vtex/api'

interface CatalogSearchProduct {
  productId: string
  items?: Array<{ itemId: string }>
}

export class Catalog extends JanusClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(context, options)
  }

  /**
   * Returns the product that owns the given SKU, or `null` when the SKU does
   * not exist or is not visible in the storefront catalog.
   */
  public async getProductIdBySku(skuId: string): Promise<string | null> {
    const products = await this.http.get<CatalogSearchProduct[]>(
      '/api/catalog_system/pub/products/search',
      {
        params: { fq: `skuId:${skuId}`, _from: 0, _to: 0 },
        metric: 'catalog-product-by-sku',
      }
    )

    const product = products.find(({ items }) =>
      items?.some(({ itemId }) => itemId === skuId)
    )

    return product?.productId ?? null
  }
}
