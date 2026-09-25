# Wishlist Service

VTEX IO backend (BFF) for authenticated storefront wishlists, consumed by the
didopet FastStore storefront through its GraphQL extension.

Every route resolves the current shopper from VTEX Session Manager using the
`vtex_session` cookie (`authentication.storeUserId` +
`profile.isAuthenticated`). Shopper identity is never read from request
parameters or the body. Anonymous requests receive `401` and every response
uses `Cache-Control: private, no-store`.

## API

All list responses share the shape
`{ "items": [{ "productId", "skuId", "createdAt" }], "count" }`, newest first.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `GET` | `/_v/private/wishlist` | — | list |
| `POST` | `/_v/private/wishlist/items` | `{ "productId": "168", "skuId": "256" }` | list including the item |
| `DELETE` | `/_v/private/wishlist/items/:skuId` | — | list without the item |
| `POST` | `/_v/private/wishlist/check` | `{ "skuIds": ["256", "302"] }` (max 50) | `{ "savedSkuIds": ["256"] }` |

Validation errors use `{ code, message }`:

- `400 INVALID_ITEM` / `INVALID_SKU` / `INVALID_SKUS`: ids must be numeric catalog ids.
- `404 SKU_NOT_FOUND`: the SKU does not exist in the storefront catalog.
- `400 SKU_PRODUCT_MISMATCH`: the SKU does not belong to `productId`.
- `502 CATALOG_UNAVAILABLE` / `500 WISHLIST_UNAVAILABLE`: upstream failures (details are only logged).

Adding and removing are idempotent. POST and DELETE build their response from
the current list plus/minus the item, because Master Data search is
eventually consistent (about 10–15 s before a new document shows up in `GET`).

## Storage

The app owns the `WLF` entity through the Master Data builder, stored as
`laburu_wishlist_service_WLF` with one schema per app version/workspace. Each
document is one favorite (`shopperId`, `productId`, `skuId`, `createdAt`).
The document id is `sha256(shopperId:skuId)`, so a shopper can hold each
SKU only once even with concurrent requests. Public reads, writes, and
filters are disabled in the schema.

## Development

From `node/`:

```sh
yarn lint
yarn test
```

Link the app in a development workspace (e.g. `wishlist`) from the repository
root, then point the storefront to it with
`WISHLIST_SERVICE_URL=https://wishlist--didopet.myvtex.com/_v/private`:

```sh
vtex link
```
