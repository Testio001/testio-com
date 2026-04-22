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
]);

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase().trim();
  return DISPOSABLE_DOMAINS.has(domain);
}