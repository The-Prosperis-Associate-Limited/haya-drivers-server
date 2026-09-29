// Money is stored in minor units everywhere - kobo for NGN, cents for USD. A
// float never touches a balance, so these two functions are the only bridge
// between what the client shows and what the database holds.
export const toMinorUnits = (amount: number) => Math.round(amount * 100);

export const toMajorUnits = (minor: number) => minor / 100;

export const formatMoney = (minor: number, currency = "NGN", locale = "en-NG") =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(toMajorUnits(minor));
