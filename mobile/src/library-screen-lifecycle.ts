/**
 * Refresh authoritative rows after a failed operation without erasing that
 * operation's actionable message. A refresh failure supersedes it because the
 * screen can no longer confirm the displayed library state.
 */
export async function refreshAfterOperationFailure<T, E>(
  operationError: E,
  refresh: () => Promise<T>,
  isCurrent: () => boolean,
  applyListing: (listing: T) => void,
  presentError: (error: E) => void,
  normalizeError: (error: unknown) => E,
) {
  if (!isCurrent()) return;
  try {
    const listing = await refresh();
    if (!isCurrent()) return;
    applyListing(listing);
    presentError(operationError);
  } catch (refreshError) {
    if (isCurrent()) presentError(normalizeError(refreshError));
  }
}
