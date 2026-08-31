import crypto from "crypto";
import { BadRequestError } from "../../helper/errors";
import type { BankOption, PaymentProvider, ResolvedAccount, TransferRecipient, TransferRequest, TransferResult } from "./payment.provider";

const { PAYSTACK_SECRET_KEY } = process.env;

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

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY as string).update(rawBody).digest("hex");

    return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}
