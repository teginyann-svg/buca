/** Domaines d’e-mails jetables / temporaires courants (liste non exhaustive). */
const DISPOSABLE_DOMAINS = new Set(
  [
    "0-mail.com",
    "10minutemail.com",
    "10minutemail.net",
    "guerrillamail.com",
    "guerrillamail.net",
    "guerrillamail.org",
    "sharklasers.com",
    "grr.la",
    "mailinator.com",
    "mailinator.net",
    "tempmail.com",
    "temp-mail.org",
    "temp-mail.io",
    "throwawaymail.com",
    "yopmail.com",
    "yopmail.fr",
    "yopmail.net",
    "trashmail.com",
    "trashmail.me",
    "getnada.com",
    "nada.email",
    "dispostable.com",
    "maildrop.cc",
    "fakeinbox.com",
    "mailnesia.com",
    "mintemail.com",
    "moakt.com",
    "emailondeck.com",
    "tempail.com",
    "tmpmail.org",
    "tmpmail.net",
    "discard.email",
    "discardmail.com",
    "mailcatch.com",
    "mytemp.email",
    "tempinbox.com",
    "jetable.org",
    "spamgourmet.com",
    "bccto.me",
    "mailnull.com",
    "spamobox.com",
    "trash-mail.com",
    "wegwerfmail.de",
    "wegwerfmail.net",
    "cool.fr.nf",
    "courriel.fr.nf",
    "jetable.fr.nf",
    "ninjemail.net",
    "getairmail.com",
    "emailfake.com",
    "fakemailgenerator.com",
    "mohmal.com",
    "burnermail.io",
    "inboxkitten.com",
    "mailforspam.com",
    "spamfree24.org",
    "tempmailo.com",
    "1secmail.com",
    "1secmail.org",
    "1secmail.net",
  ].map((d) => d.toLowerCase()),
);

export function extractEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return null;
  return trimmed.slice(at + 1);
}

/** True si l’e-mail semble utiliser un domaine jetable. */
export function isDisposableEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // sous-domaine d’un domaine jetable connu
  for (const blocked of DISPOSABLE_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

export function assertNotDisposableEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Adresse e-mail invalide.";
  }
  if (isDisposableEmail(value)) {
    return "Les adresses e-mail temporaires ne sont pas acceptées.";
  }
  return null;
}
