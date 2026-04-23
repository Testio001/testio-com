// Common disposable / temporary email domains. Not exhaustive, but catches
// the most popular abuse vectors (mailinator, tempmail, guerrilla, etc.).
const DISPOSABLE_DOMAINS = new Set<string>([
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "10minutemail.com",
  "10minutemail.net",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "sharklasers.com",
  "yopmail.com",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.de",
  "getnada.com",
  "fakeinbox.com",
  "maildrop.cc",
  "dispostable.com",
  "mintemail.com",
  "mohmal.com",
  "moakt.com",
  "emailondeck.com",
  "tempinbox.com",
  "spam4.me",
  "tempr.email",
  "discard.email",
  "mailnesia.com",
  "inboxbear.com",
  "burnermail.io",
  "mvrht.net",
  "anonbox.net",
  "fakemail.net",
  "mytemp.email",
  "mailcatch.com",
  "trbvm.com",
  "spambog.com",
  "spamgourmet.com",
  "tempemail.net",
  "tempemail.co",
  "20minutemail.com",
  "1secmail.com",
  "1secmail.net",
  "1secmail.org",
  "anonymousmail.org",
  "throwam.com",
  "minitts.net",
  "minitts.com",
]);

// Heuristic keywords commonly found in disposable / throwaway email domains.
// Catches new providers we haven't explicitly listed (e.g. "minitts" style
// random-name temp services, "*-temp.com", "trashmail.*", etc.).
const DISPOSABLE_KEYWORDS = [
  "temp",
  "tmp",
  "trash",
  "fake",
  "throwaway",
  "throw-away",
  "disposable",
  "minute",
  "10min",
  "20min",
  "1sec",
  "burner",
  "junk",
  "spam",
  "yopmail",
  "guerrilla",
  "mailinator",
  "getnada",
  "maildrop",
  "discard",
  "anonbox",
  "mintemail",
  "mohmal",
  "moakt",
  "sharklasers",
  "inboxbear",
  "mailcatch",
  "mailnesia",
  "nada",
  "mintts",
  "minitts",
];

// Trusted mainstream providers we should never flag, even if a keyword
// happens to appear in the local part of a sub-brand domain.
const TRUSTED_DOMAINS = new Set<string>([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.in",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "aol.com",
  "zoho.com",
  "gmx.com",
  "gmx.net",
  "yandex.com",
  "yandex.ru",
  "mail.com",
  "fastmail.com",
  "tutanota.com",
  "tuta.io",
]);

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase().trim();
  if (!domain) return false;
  if (TRUSTED_DOMAINS.has(domain)) return false;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;

  // Heuristic: keyword anywhere in the domain (e.g. "minitts.net",
  // "anytemp.xyz", "trashbox.io", "spambog.org").
  for (const kw of DISPOSABLE_KEYWORDS) {
    if (domain.includes(kw)) return true;
  }

  // Heuristic: very short, random-looking TLDs commonly abused by
  // throwaway providers (e.g. .xyz, .top, .click, .gq, .tk, .ml, .cf, .ga).
  const SUSPICIOUS_TLDS = [".xyz", ".top", ".click", ".gq", ".tk", ".ml", ".cf", ".ga", ".buzz", ".rest"];
  for (const tld of SUSPICIOUS_TLDS) {
    if (domain.endsWith(tld)) return true;
  }

  return false;
}