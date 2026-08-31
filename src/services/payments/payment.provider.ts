export interface BankOption {
  name: string;
  code: string;
  currency: string;
}

export interface ResolvedAccount {
  account_number: string;
  account_name: string;
}

export interface TransferRecipient {
  recipient_code: string;
}

export interface TransferRequest {
  amount_minor: number;
  currency: string;
  recipient_code: string;
  reference: string;
  reason?: string;
}

export interface TransferResult {
  provider_ref: string;
  status: "PROCESSING" | "PAID" | "FAILED";
  failure_reason?: string;
}

/*
  Every payment provider is reached through this interface, so adding a region
  is a new implementation plus an entry in the registry — never a change to the
  payout or wallet services. Paystack covers Nigeria today; the same shape fits
  Stripe, Flutterwave or a bank rail elsewhere.
*/
export interface PaymentProvider {
  readonly name: "PAYSTACK" | "STRIPE" | "MANUAL";
  readonly currencies: string[];

  listBanks(country: string): Promise<BankOption[]>;
  resolveAccount(accountNumber: string, bankCode: string): Promise<ResolvedAccount>;
  createTransferRecipient(input: { account_number: string; bank_code: string; account_name: string; currency: string }): Promise<TransferRecipient>;
  transfer(request: TransferRequest): Promise<TransferResult>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
}
