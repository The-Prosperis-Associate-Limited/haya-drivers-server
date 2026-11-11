/*
  The single source of hire pricing truth. The client pays drivers their salary
  DIRECTLY - our invoice is only the service fee below, plus VAT on that fee.
  When the business changes a number, it changes here and nowhere else.
*/

export type HireClientType = "INDIVIDUAL" | "ORGANISATION";

// All naira figures in minor units (kobo).
const N = (naira: number) => naira * 100;

export const HIRE_FEE_PERCENT = 10;

export const defaultVatPercent = Number(process.env.HIRE_VAT_PERCENT ?? 7.5);

export interface HireFeeLine {
  label: string;
  amount_minor: number;
}

export interface HireFeeQuote {
  fee_minor: number;
  lines: HireFeeLine[];
}

interface FeeParams {
  engagement_type: "MONTHLY" | "CONTRACT";
  drivers: number;
  // Monthly salary for full-time, the whole contract's pay for a contract.
  per_driver_minor: number;
  duration_days?: number | null;
}

export class ContractDurationRequiredError extends Error {
  constructor() {
    super("A contract hire needs its duration (in days) before it can be priced");
    this.name = "ContractDurationRequiredError";
  }
}

const feeOn = (gross_minor: number) => Math.round((gross_minor * HIRE_FEE_PERCENT) / 100);

export const computeHireFee = ({ engagement_type, drivers, per_driver_minor, duration_days }: FeeParams): HireFeeQuote => {
  const times = drivers > 1 ? ` x ${drivers} drivers` : "";

  if (engagement_type === "MONTHLY") {
    const fee = feeOn(per_driver_minor * 12) * drivers;

    return { fee_minor: fee, lines: [{ label: `Service fee - ${HIRE_FEE_PERCENT}% of annual gross${times}`, amount_minor: fee }] };
  }

  if (!duration_days || duration_days < 1) throw new ContractDurationRequiredError();

  const fee = feeOn(per_driver_minor) * drivers;

  return { fee_minor: fee, lines: [{ label: `Service fee - ${HIRE_FEE_PERCENT}% of contract pay (${duration_days} days)${times}`, amount_minor: fee }] };
};

export const hirePricingGuide = () => ({
  fee_percent: HIRE_FEE_PERCENT,
  vat_percent: defaultVatPercent,
  full_time: {
    example: {
      monthly_minor: N(250_000),
      annual_minor: N(3_000_000),
      fee_minor: feeOn(N(3_000_000)),
    },
  },
  contract: {
    example: {
      days: 60,
      pay_minor: N(500_000),
      fee_minor: feeOn(N(500_000)),
    },
  },
});
