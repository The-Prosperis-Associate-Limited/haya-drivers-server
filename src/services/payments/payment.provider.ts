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

export interface DedicatedAccountParams {
  email: string;
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
}

export interface DedicatedAccount {
  account_number: string;
  account_name: string;
  bank_name: string;
  customer_code: string;
}

export interface FundingRecord {
  reference: string;
  amount_minor: number;
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
  createDedicatedAccount(params: DedicatedAccountParams): Promise<DedicatedAccount>;
  listFundingEvents(customerCode: string): Promise<FundingRecord[]>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
}
