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
`{vendor}_wishlist_service_WLF` (e.g. `didopet_wishlist_service_WLF`) with
one schema per app version/workspace. Each
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

## Installing in another account

The app is private (no `billingOptions`), so it can only be installed in the
account named as `vendor` in `manifest.json`. The code has no account-specific
values: the catalog client and Master Data client resolve the account from the
request context, and the storefront routes are the same in every store. To use
it for another FastStore store (e.g. `newaccount`):

1. Copy the repository (or create a branch per client).
2. In `manifest.json`, set `"vendor": "newaccount"` and reset `"version"` to
   `0.0.1`.
3. Log in to that account:

   ```sh
   vtex login newaccount
   ```

4. **Create the `WLF` entity before the first publish.** If the entity does not
   exist, the Master Data builder fails with
   `Schema creation for newaccount_wishlist_service_WLF/0.0.1 failed. undefined`
   and `Request failed with status code 403`. From the repository root:

   ```sh
   T=$(python3 -c "import json;print(json.load(open('$HOME/.vtex/session/session.json'))['token'])")
   curl -s -X PUT -H "VtexIdclientAutCookie: $T" -H "Content-Type: application/json" \
     --data @masterdata/WLF/schema.json \
     "https://newaccount.vtexcommercestable.com.br/api/dataentities/WLF/schemas/wishlist-test" \
     -w "\n%{http_code}\n"
   ```

   It must return `200`.

5. Publish, deploy, and install:

   ```sh
   vtex publish
   vtex deploy newaccount.wishlist-service@0.0.1
   vtex use master
   vtex install newaccount.wishlist-service@0.0.1
   ```

6. Delete the temporary schema:

   ```sh
   curl -s -X DELETE -H "VtexIdclientAutCookie: $T" \
     "https://newaccount.vtexcommercestable.com.br/api/dataentities/WLF/schemas/wishlist-test" \
     -w "\n%{http_code}\n"
   ```

7. Point the store's FastStore storefront to
   `https://newaccount.myvtex.com/_v/private` (or a workspace URL while
   testing). No code changes are needed.

To check the install, `GET /api/dataentities/WLF/schemas` should list
`newaccount_wishlist_service_WLF`, and a logged-in shopper should be able to
add an item and see it in the list.

If many stores will use the app, publish it once under the agency's own VTEX
account with `billingOptions` (`"type": "free"`) so any account can install
`agency.wishlist-service` from a single codebase. Do not make it public under a
client's account. Each new account may still need the `WLF` entity created
first (step 4).
