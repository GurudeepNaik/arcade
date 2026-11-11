/** First-party cookie holding a random id per browser, so a visitor keeps one id when their IP changes. */
export const BROWSER_COOKIE = "vid";
export const BROWSER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** EU, EEA, UK and Switzerland: a tracking cookie needs consent there, and this site has no banner. */
const CONSENT_COUNTRIES = new Set([
  "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GR", "HR", "HU", "IE",
  "IS", "IT", "LI", "LT", "LU", "LV", "MT", "NL", "NO", "PL", "PT", "RO", "SE", "SI", "SK",
]);

export function isBrowserId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** An unknown country counts as needing consent, so those visitors stay on the IP-based id. */
export function mayUseBrowserCookie(country: string | null): boolean {
  return country !== null && country !== "" && !CONSENT_COUNTRIES.has(country);
}

/** Reads the id from a raw Cookie header, for route handlers. Null when absent or malformed. */
export function browserIdFromCookieHeader(header: string | null): string | null {
  const match = (header ?? "").match(new RegExp(`(?:^|;\\s*)${BROWSER_COOKIE}=([^;]+)`));
  return match && isBrowserId(match[1]) ? match[1] : null;
}
