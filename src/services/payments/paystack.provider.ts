import crypto from "crypto";
import { BadRequestError } from "../../helper/errors";
import type { BankOption, DedicatedAccount, DedicatedAccountParams, FundingRecord, PaymentProvider, ResolvedAccount, TransferRecipient, TransferRequest, TransferResult } from "./payment.provider";

const { PAYSTACK_SECRET_KEY, PAYSTACK_DVA_BANK } = process.env;

const BASE_URL = "https://api.paystack.co";

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

export class PaystackProvider implements PaymentProvider {
  readonly name = "PAYSTACK" as const;
  readonly currencies = ["NGN", "GHS", "ZAR", "KES"];

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    const body = (await response.json()) as PaystackResponse<T>;

    if (!response.ok || !body.status) throw new BadRequestError(body.message || "Paystack request failed");

    return body.data;
  }

  async listBanks(country: string): Promise<BankOption[]> {
    const banks = await this.request<{ name: string; code: string; currency: string }[]>(`/bank?country=${encodeURIComponent(country)}`);

    return banks.map(bank => ({ name: bank.name, code: bank.code, currency: bank.currency }));
  }

  async resolveAccount(accountNumber: string, bankCode: string): Promise<ResolvedAccount> {
    return this.request<ResolvedAccount>(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
  }

  async createTransferRecipient(input: { account_number: string; bank_code: string; account_name: string; currency: string }): Promise<TransferRecipient> {
    const recipient = await this.request<{ recipient_code: string }>("/transferrecipient", {
      method: "POST",
      body: JSON.stringify({
        type: "nuban",
        name: input.account_name,
        account_number: input.account_number,
        bank_code: input.bank_code,
        currency: input.currency,
      }),
    });

    return { recipient_code: recipient.recipient_code };
  }

  async transfer(request: TransferRequest): Promise<TransferResult> {
    const transfer = await this.request<{ transfer_code: string; status: string }>("/transfer", {
      method: "POST",
      body: JSON.stringify({
        source: "balance",
        amount: request.amount_minor,
        recipient: request.recipient_code,
        reference: request.reference,
        reason: request.reason ?? "TEGAT driver payout",
        currency: request.currency,
      }),
    });

    // Paystack answers "success" only for instant transfers; everything else
    // settles asynchronously and is confirmed by webhook.
    return {
      provider_ref: transfer.transfer_code,
      status: transfer.status === "success" ? "PAID" : "PROCESSING",
    };
  }

  // A Paystack customer first, then the account against it. "test-bank" in
  // test mode; Wema is Paystack's production DVA partner.
  async createDedicatedAccount(params: DedicatedAccountParams): Promise<DedicatedAccount> {
    const customer = await this.request<{ customer_code: string }>("/customer", {
      method: "POST",
      body: JSON.stringify({
        email: params.email,
        first_name: params.first_name,
        last_name: params.last_name ?? undefined,
        phone: params.phone ?? undefined,
      }),
    });

    const account = await this.request<{ account_number: string; account_name: string; bank: { name: string } }>("/dedicated_account", {
      method: "POST",
      body: JSON.stringify({
        customer: customer.customer_code,
        preferred_bank: PAYSTACK_DVA_BANK ?? "wema-bank",
      }),
    });

    return {
      account_number: account.account_number,
      account_name: account.account_name,
      bank_name: account.bank.name,
      customer_code: customer.customer_code,
    };
  }

  // Poll fallback for webhooks that never arrived — the transactions list keys
  // on Paystack's numeric customer id, not the customer code.
  async listFundingEvents(customerCode: string): Promise<FundingRecord[]> {
    const customer = await this.request<{ id: number }>(`/customer/${customerCode}`);

    const transactions = await this.request<{ reference: string; amount: number; status: string }[]>(`/transaction?customer=${customer.id}&status=success&perPage=20`);

    return transactions.filter(entry => entry.status === "success").map(entry => ({ reference: entry.reference, amount_minor: entry.amount }));
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY as string)
      .update(rawBody)
      .digest("hex");

    return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}
