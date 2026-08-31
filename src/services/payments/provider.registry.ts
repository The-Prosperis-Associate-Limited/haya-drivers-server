import { BadRequestError } from "../../helper/errors";
import type { PaymentProvider } from "./payment.provider";
import { PaystackProvider } from "./paystack.provider";

const providers: PaymentProvider[] = [new PaystackProvider()];

/*
  Currency decides the provider, not the caller. A payout service never names
  Paystack, so opening a new region is one implementation plus one entry here.
*/
export const resolveProvider = (currency: string): PaymentProvider => {
  const provider = providers.find(candidate => candidate.currencies.includes(currency.toUpperCase()));

  if (!provider) throw new BadRequestError(`Payouts in ${currency} are not supported yet`);

  return provider;
};

export const resolveProviderByName = (name: PaymentProvider["name"]): PaymentProvider => {
  const provider = providers.find(candidate => candidate.name === name);

  if (!provider) throw new BadRequestError(`Unknown payment provider: ${name}`);

  return provider;
};

export const supportedCurrencies = () => [...new Set(providers.flatMap(provider => provider.currencies))];
