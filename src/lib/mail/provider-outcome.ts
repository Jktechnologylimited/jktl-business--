/** A provider transport/server error is not proof that submission did not
 * happen. Retry only explicit client-side rejections; hold ambiguous outcomes. */
export function uncertainProviderRejection(error: {
  statusCode?: number | null;
}) {
  return ![400, 401, 403, 404, 413, 422, 429].includes(error.statusCode || 0);
}
