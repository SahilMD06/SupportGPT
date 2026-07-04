/**
 * Safely extracts a human-readable error message from an API error response.
 *
 * FastAPI returns errors in two different shapes:
 * 1. String detail — from `raise HTTPException(detail="Invalid password")`
 * 2. Array of validation objects — from Pydantic validation failures (422),
 *    e.g. malformed email, password too short, missing field.
 *
 * Passing shape #2 directly into a toast/alert crashes React because
 * objects are not valid children. This function normalizes both shapes
 * into a single safe string.
 */
export function getErrorMessage(err: any, fallback: string = 'Something went wrong'): string {
  const detail = err?.response?.data?.detail;

  if (!detail) return fallback;

  // Case 1: simple string message
  if (typeof detail === 'string') return detail;

  // Case 2: Pydantic validation error array
  if (Array.isArray(detail)) {
    const messages = detail.map((e: any) => {
      const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : 'value';
      const readableField = typeof field === 'string'
        ? field.charAt(0).toUpperCase() + field.slice(1)
        : 'Field';
      return `${readableField}: ${e.msg}`;
    });
    return messages.join(' · ');
  }

  return fallback;
}
