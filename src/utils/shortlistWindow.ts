const { SHORTLIST_RESPONSE_HOURS } = process.env;

export const SHORTLIST_WINDOW_HOURS = Number(SHORTLIST_RESPONSE_HOURS ?? 24);

export const SHORTLIST_RESPONSE_MS = SHORTLIST_WINDOW_HOURS * 60 * 60 * 1000;

export const shortlistRespondBy = (from = new Date()) => new Date(from.getTime() + SHORTLIST_RESPONSE_MS);
