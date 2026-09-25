export async function setPrivateNoStore(
  ctx: Context,
  next: () => Promise<unknown>
) {
  ctx.set('Cache-Control', 'private, no-store')
  await next()
}
