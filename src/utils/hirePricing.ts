/*
  The single source of hire pricing truth. The client pays drivers their salary
  DIRECTLY - our invoice is only the service fee below, plus VAT on that fee.
  When the business changes a number, it changes here and nowhere else.
*/

export type HireClientType = "INDIVIDUAL" | "ORGANISATION";

// All naira figures in minor units (kobo).
const N = (naira: number) => naira * 100;

export const FULL_TIME_ANNUAL_FEE_PERCENT = 12;

// Flat fee for the whole engagement, per driver, picked by contract length.
export const CONTRACT_FEE_BRACKETS = [
  { max_days: 1, label: "1 day", INDIVIDUAL: N(7_500), ORGANISATION: N(15_000) },
  { max_days: 3, label: "2-3 days", INDIVIDUAL: N(12_000), ORGANISATION: N(20_000) },
  { max_days: 7, label: "4-7 days", INDIVIDUAL: N(20_000), ORGANISATION: N(30_000) },
  { max_days: 14, label: "8-14 days", INDIVIDUAL: N(30_000), ORGANISATION: N(40_000) },
  { max_days: 30, label: "15-30 days", INDIVIDUAL: N(40_000), ORGANISATION: N(50_000) },
  { max_days: 90, label: "1-3 months", INDIVIDUAL: N(100_000), ORGANISATION: N(350_000) },
  { max_days: 180, label: "3-6 months", INDIVIDUAL: N(250_000), ORGANISATION: N(750_000) },
  { max_days: 300, label: "6-10 months", INDIVIDUAL: N(500_000), ORGANISATION: N(1_000_000) },
  { max_days: 365, label: "10-12 months", INDIVIDUAL: N(1_000_000), ORGANISATION: N(1_500_000) },
] as const;

// Contract hires longer than 30 days with 2+ drivers: this comes off the fee
// for every driver after the first.
export const MULTI_DRIVER_DISCOUNT = {
  min_duration_days: 31,
  INDIVIDUAL: N(5_000),
  ORGANISATION: N(10_000),
} as const;

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
  client_type: HireClientType;
  drivers: number;
  // Per-driver monthly salary, minor units - full-time fees derive from it.
  per_driver_monthly_minor: number;
  // Contract length - required for CONTRACT pricing.
  duration_days?: number | null;
}

export class ContractDurationRequiredError extends Error {
  constructor() {
    super("A contract hire needs its duration (in days) before it can be priced");
    this.name = "ContractDurationRequiredError";
  }
}

export const contractBracketFor = (durationDays: number) => CONTRACT_FEE_BRACKETS.find(bracket => durationDays <= bracket.max_days) ?? CONTRACT_FEE_BRACKETS[CONTRACT_FEE_BRACKETS.length - 1];

export const computeHireFee = ({ engagement_type, client_type, drivers, per_driver_monthly_minor, duration_days }: FeeParams): HireFeeQuote => {
  if (engagement_type === "MONTHLY") {
    const annual = per_driver_monthly_minor * 12;
    const perDriverFee = Math.round((annual * FULL_TIME_ANNUAL_FEE_PERCENT) / 100);
    const fee = perDriverFee * drivers;

    return {
      fee_minor: fee,
      lines: [
        {
          label: `Service fee - ${FULL_TIME_ANNUAL_FEE_PERCENT}% of annual gross${drivers > 1 ? ` x ${drivers} drivers` : ""}`,
          amount_minor: fee,
        },
      ],
    };
  }

  if (!duration_days || duration_days < 1) throw new ContractDurationRequiredError();

  const bracket = contractBracketFor(duration_days);
  const bracketFee = bracket[client_type];
  const base = bracketFee * drivers;

  const lines: HireFeeLine[] = [
    {
      label: `Contract fee (${bracket.label})${drivers > 1 ? ` x ${drivers} drivers` : ""}`,
      amount_minor: base,
    },
  ];

  let discount = 0;

  if (drivers > 1 && duration_days >= MULTI_DRIVER_DISCOUNT.min_duration_days) {
    discount = MULTI_DRIVER_DISCOUNT[client_type] * (drivers - 1);
    lines.push({
      label: `Multi-driver discount x ${drivers - 1} additional driver(s)`,
      amount_minor: -discount,
    });
  }

  return { fee_minor: base - discount, lines };
};

// Everything the admin-facing "how pricing works" guide renders - served from
// here so the guide can never drift from the maths above.
export const hirePricingGuide = () => ({
  full_time: {
    annual_fee_percent: FULL_TIME_ANNUAL_FEE_PERCENT,
    example: {
      monthly_minor: N(250_000),
      annual_minor: N(3_000_000),
      fee_minor: Math.round((N(3_000_000) * FULL_TIME_ANNUAL_FEE_PERCENT) / 100),
    },
  },
  contract: {
    brackets: CONTRACT_FEE_BRACKETS.map(bracket => ({
      label: bracket.label,
      max_days: bracket.max_days,
      individual_minor: bracket.INDIVIDUAL,
      corporate_minor: bracket.ORGANISATION,
    })),
    multi_driver_discount: {
      min_duration_days: MULTI_DRIVER_DISCOUNT.min_duration_days,
      individual_minor: MULTI_DRIVER_DISCOUNT.INDIVIDUAL,
      corporate_minor: MULTI_DRIVER_DISCOUNT.ORGANISATION,
    },
  },
});
