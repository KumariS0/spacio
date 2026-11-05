/**
 * Facility QR payload: a plain URL to the scanner page carrying an opaque
 * token. A phone's camera app opens SPACIO directly; the in-app scanner reads
 * the same URL. No student data or credentials are ever encoded.
 */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function buildQrPayload(siteUrl: string, token: string) {
  return `${siteUrl.replace(/\/$/, "")}/scan?t=${encodeURIComponent(token)}`;
}

/** Extracts a token from a scanned URL or a bare token. Returns null if invalid. */
export function parseQrPayload(raw: string): string | null {
  const text = raw.trim();
  if (TOKEN_RE.test(text)) return text;
  try {
    const url = new URL(text);
    const t = url.searchParams.get("t");
    if (url.pathname.replace(/\/$/, "").endsWith("/scan") && t && TOKEN_RE.test(t)) return t;
  } catch {
    /* not a URL */
  }
  return null;
}

export function isValidToken(token: string) {
  return TOKEN_RE.test(token);
}

/**
 * Booking pass payload: a link to the admin pass scanner carrying the
 * booking's own random pass token. Like facility codes, it holds no student
 * data; an admin's scan looks the booking up on the server.
 */
export function buildPassPayload(siteUrl: string, token: string) {
  return `${siteUrl.replace(/\/$/, "")}/admin/scan?p=${encodeURIComponent(token)}`;
}

/** Extracts a pass token from a scanned pass URL or a bare token. Returns null if invalid. */
export function parsePassPayload(raw: string): string | null {
  const text = raw.trim();
  if (TOKEN_RE.test(text)) return text;
  try {
    const url = new URL(text);
    const p = url.searchParams.get("p");
    if (url.pathname.replace(/\/$/, "").endsWith("/admin/scan") && p && TOKEN_RE.test(p)) return p;
  } catch {
    /* not a URL */
  }
  return null;
}
