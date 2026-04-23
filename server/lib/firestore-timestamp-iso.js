/**
 * Serialize Firestore Timestamp (Admin or client shape) to ISO 8601 for JSON APIs.
 * @param {unknown} value
 * @returns {string | null}
 */
export function firestoreTimestampToIso(value) {
  if (value == null) return null;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof /** @type {{ toDate?: unknown }} */ (value).toDate === 'function'
  ) {
    const d = /** @type {{ toDate: () => Date }} */ (value).toDate();
    return d instanceof Date && !Number.isNaN(d.getTime())
      ? d.toISOString()
      : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
}
