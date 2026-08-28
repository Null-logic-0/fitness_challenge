/**
 * ISO 3166-1 alpha-2 country codes. Storing the code (not a free-text name)
 * keeps the value consistent for exact-match filtering (the leaderboard's
 * "Country" scope) regardless of what language a profile was created in —
 * labels are generated per-locale via Intl.DisplayNames below rather than
 * hand-translated, the same Intl-first approach used everywhere else in
 * this project for numbers/dates/pluralization.
 */
export const COUNTRY_CODES = [
  'AF', 'AL', 'DZ', 'AD', 'AO', 'AG', 'AR', 'AM', 'AU', 'AT',
  'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BT',
  'BO', 'BA', 'BW', 'BR', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH',
  'CM', 'CA', 'CF', 'TD', 'CL', 'CN', 'CO', 'KM', 'CG', 'CD',
  'CR', 'CI', 'HR', 'CU', 'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO',
  'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FJ', 'FI',
  'FR', 'GA', 'GM', 'GE', 'DE', 'GH', 'GR', 'GD', 'GT', 'GN',
  'GW', 'GY', 'HT', 'HN', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ',
  'IE', 'IL', 'IT', 'JM', 'JP', 'JO', 'KZ', 'KE', 'KI', 'KP',
  'KR', 'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI',
  'LT', 'LU', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MR',
  'MU', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MA', 'MZ', 'MM',
  'NA', 'NR', 'NP', 'NL', 'NZ', 'NI', 'NE', 'NG', 'MK', 'NO',
  'OM', 'PK', 'PW', 'PA', 'PG', 'PY', 'PE', 'PH', 'PL', 'PT',
  'QA', 'RO', 'RU', 'RW', 'KN', 'LC', 'VC', 'WS', 'SM', 'ST',
  'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SK', 'SI', 'SB', 'SO',
  'ZA', 'SS', 'ES', 'LK', 'SD', 'SR', 'SE', 'CH', 'SY', 'TW',
  'TJ', 'TZ', 'TH', 'TL', 'TG', 'TO', 'TT', 'TN', 'TR', 'TM',
  'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UY', 'UZ', 'VU', 'VA',
  'VE', 'VN', 'YE', 'ZM', 'ZW',
];

/**
 * @param {string} localeTag - BCP-47 tag, e.g. 'en-US', 'ka-GE'
 * @returns {{code: string, name: string}[]} sorted by localized name
 */
export function getCountryOptions(localeTag) {
  const displayNames = new Intl.DisplayNames([localeTag], { type: 'region' });
  return COUNTRY_CODES
    .map((code) => ({ code, name: displayNames.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, localeTag));
}

/**
 * Renders a stored ISO code back to a localized name wherever a country is
 * just displayed (not chosen) — athlete profiles, leaderboard rows, etc.
 * Falls back to the raw code for anything that isn't a valid region code
 * (e.g. old free-text values from before the dropdown existed).
 * @param {string|null|undefined} code
 * @param {string} localeTag
 * @returns {string}
 */
export function getCountryName(code, localeTag) {
  if (!code) return '';
  try {
    return new Intl.DisplayNames([localeTag], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
