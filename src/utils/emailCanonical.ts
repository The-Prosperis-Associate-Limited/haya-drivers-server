const DOTLESS_PROVIDERS = new Set(["gmail.com", "googlemail.com"]);

// Gmail ignores dots and anything after "+", so j.doe+2@gmail.com and jdoe@gmail.com are one mailbox.
export const canonicalEmail = (email: string) => {
  const [rawLocal, rawDomain = ""] = email.trim().toLowerCase().split("@");
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;
  let local = rawLocal.split("+")[0];

  if (DOTLESS_PROVIDERS.has(domain)) local = local.replace(/\./g, "");

  return `${local}@${domain}`;
};
