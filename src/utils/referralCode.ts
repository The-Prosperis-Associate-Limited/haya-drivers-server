import crypto from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const REFERRAL_CODE_PATTERN = /^[A-Z]{2,10}-[A-Z2-9]{4}$/;

export const normaliseReferralCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

export const generateReferralCode = (firstName?: string | null) => {
  const prefix =
    (firstName ?? "")
      .normalize("NFD")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(0, 10) || "DRIVER";
  const suffix = Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(0, ALPHABET.length)]).join("");

  return `${prefix.length < 2 ? "DRIVER" : prefix}-${suffix}`;
};
