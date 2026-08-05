/**
 * Company name normalization for cross-source deduplication
 * Removes legal suffixes, punctuation, and normalizes spacing/casing
 */

export function normalizeCompanyName(name: string | undefined): string | null {
  if (!name || typeof name !== 'string') return null;
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')                                        // Collapse multiple spaces
    .replace(/\b(corp|corp\.|corporation|co|co\.|inc|inc\.|llc|ltd|ltd\.|pllc|gmbh|sa|ag|pty|srl)\b/gi, '') // Remove legal suffixes
    .replace(/[.,!?;:'"()&\-]/g, '')                            // Remove punctuation
    .replace(/\s+/g, ' ')                                        // Re-collapse spaces after removal
    .trim();
}

