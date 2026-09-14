import crypto from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const randomBlock = (length: number) =>
  Array.from({ length }, () => ALPHABET[crypto.randomInt(0, ALPHABET.length)]).join("");

// Human-readable and safe to read down a phone line — no characters that look
// like each other (0/O, 1/I).
export const generateReference = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBlock(5)}`;

export const generateNumericCode = (digits = 6) => {
  const max = 10 ** digits;
  return crypto.randomInt(0, max).toString().padStart(digits, "0");
};

// Guaranteed to pass the password policy (length, letter, number, symbol).
export const generateTemporaryPassword = () => {
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const pick = (set: string) => set[crypto.randomInt(0, set.length)];
  const body = Array.from({ length: 8 }, () => pick(ALPHABET + lower)).join("");

  return `${pick(ALPHABET)}${body}${pick(digits)}${pick(symbols)}`;
};
