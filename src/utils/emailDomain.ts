const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "sharklasers.com",
  "getnada.com",
  "trashmail.com",
  "fakeinbox.com",
  "maildrop.cc",
  "dispostable.com",
  "mintemail.com",
  "moakt.com",
  "emailondeck.com",
]);

/*
  Rejects throwaway mailbox services only - never public providers like Gmail or
  Yahoo. A disposable mailbox is not durable, so nothing we send can be relied
  on to arrive, and a driver's verification result has to reach them. A public
  mailbox is real; almost every driver on the platform will have one.
*/
export const isDisposableEmailDomain = (email: string) => {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return false;

  return DISPOSABLE_DOMAINS.has(domain);
};
