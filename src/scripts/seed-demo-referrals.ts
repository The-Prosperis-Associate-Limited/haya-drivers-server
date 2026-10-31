import "dotenv/config";
import type { $Enums } from "../generated/prisma/client";
import { prisma } from "../helper/prisma";
import { generateRandomPassword, hashPassword } from "../helper/hashPassword";
import { generateReference } from "../utils/reference";
import { REFERRAL_CONFIG } from "../utils/referralConfig";
import { ReferralCodeService } from "../services/referral/referral.code.service";
import { WalletService } from "../services/earnings/wallet.service";
import { maskedName } from "../services/referral/referral.reward.service";
import { RISK_FLAGS, type RiskFlag } from "../services/referral/referral.risk.service";

type Scenario = "SIGNED_UP" | "REWARDED" | "REWARDED_ON_HOLD" | "HELD" | "APPROVED_AFTER_HOLD" | "AUTO_REJECTED" | "ADMIN_REJECTED" | "REVERSED";

interface DemoReferee {
  key: string;
  first_name: string;
  last_name: string;
  gender: $Enums.Gender;
  city: string;
  state: string;
  referrer: string;
  days_ago: number;
  scenario: Scenario;
  channel?: $Enums.ReferralChannel;
  flags?: string[];
  note?: string;
}

const DEMO_DOMAIN = "tegat.test";
const PLACEHOLDER_IMAGE = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
const DOCUMENTS: $Enums.DocumentType[] = ["NIN_SLIP", "PASSPORT_PHOTO", "DRIVERS_LICENCE", "PROOF_OF_ADDRESS", "GUARANTOR_PASSPORT", "GUARANTOR_NIN_SLIP"];
const DAY = 24 * 60 * 60 * 1000;

const REFERRERS: Record<string, string> = {
  abdullah: "officialayo540@gmail.com",
  tunde: "seed.driver01@hayadrivers.com",
  aisha: "seed.driver02@hayadrivers.com",
  chinedu: "seed.driver03@hayadrivers.com",
};

const REFEREES: DemoReferee[] = [
  { key: "femi", first_name: "Femi", last_name: "Ogunbiyi", gender: "MALE", city: "Surulere", state: "Lagos", referrer: "abdullah", days_ago: 41, scenario: "REWARDED" },
  { key: "zainab", first_name: "Zainab", last_name: "Yusuf", gender: "FEMALE", city: "Wuse", state: "Abuja Federal Capital Territory", referrer: "abdullah", days_ago: 33, scenario: "REWARDED" },
  { key: "ifeanyi", first_name: "Ifeanyi", last_name: "Chukwu", gender: "MALE", city: "Lekki", state: "Lagos", referrer: "abdullah", days_ago: 24, scenario: "REWARDED", channel: "ONBOARDING" },
  { key: "obinna", first_name: "Obinna", last_name: "Eze", gender: "MALE", city: "Yaba", state: "Lagos", referrer: "abdullah", days_ago: 3, scenario: "REWARDED_ON_HOLD" },
  { key: "tolu", first_name: "Tolu", last_name: "Bakare", gender: "FEMALE", city: "Ikeja", state: "Lagos", referrer: "abdullah", days_ago: 5, scenario: "SIGNED_UP" },
  { key: "bisi", first_name: "Bisi", last_name: "Lawal", gender: "FEMALE", city: "Ibadan", state: "Oyo", referrer: "femi", days_ago: 16, scenario: "REWARDED" },
  { key: "kunle", first_name: "Kunle", last_name: "Ajayi", gender: "MALE", city: "Ikorodu", state: "Lagos", referrer: "femi", days_ago: 2, scenario: "SIGNED_UP", channel: "ONBOARDING" },
  { key: "musa", first_name: "Musa", last_name: "Garba", gender: "MALE", city: "Kano", state: "Kano", referrer: "tunde", days_ago: 20, scenario: "REWARDED" },
  {
    key: "esther",
    first_name: "Esther",
    last_name: "Akpan",
    gender: "FEMALE",
    city: "Uyo",
    state: "Akwa Ibom",
    referrer: "tunde",
    days_ago: 17,
    scenario: "REVERSED",
    note: "Driver's licence failed re-verification with FRSC after the reward was released.",
  },
  { key: "kola", first_name: "Kola", last_name: "Adeyemi", gender: "MALE", city: "Ikeja", state: "Lagos", referrer: "tunde", days_ago: 2, scenario: "HELD", flags: ["SAME_NETWORK_AS_REFERRER"] },
  { key: "uche", first_name: "Uche", last_name: "Nnaji", gender: "MALE", city: "Enugu", state: "Enugu", referrer: "tunde", days_ago: 1, scenario: "HELD", flags: ["DEVICE_SHARED", "GUARANTOR_REUSED"] },
  { key: "sani", first_name: "Sani", last_name: "Bello", gender: "MALE", city: "Kaduna", state: "Kaduna", referrer: "musa", days_ago: 4, scenario: "SIGNED_UP" },
  { key: "amaka", first_name: "Amaka", last_name: "Obi", gender: "FEMALE", city: "Garki", state: "Abuja Federal Capital Territory", referrer: "aisha", days_ago: 18, scenario: "REWARDED" },
  { key: "hauwa", first_name: "Hauwa", last_name: "Bello", gender: "FEMALE", city: "Maitama", state: "Abuja Federal Capital Territory", referrer: "aisha", days_ago: 11, scenario: "AUTO_REJECTED", flags: ["SELF_EMAIL_ALIAS"] },
  {
    key: "peter",
    first_name: "Peter",
    last_name: "Idowu",
    gender: "MALE",
    city: "Kubwa",
    state: "Abuja Federal Capital Territory",
    referrer: "aisha",
    days_ago: 8,
    scenario: "ADMIN_REJECTED",
    flags: ["LICENCE_REUSED", "SAME_NETWORK_AS_REFERRER"],
    note: "Licence number belongs to an existing driver account; referee could not explain the match.",
  },
  {
    key: "grace",
    first_name: "Grace",
    last_name: "Etim",
    gender: "FEMALE",
    city: "Port Harcourt",
    state: "Rivers",
    referrer: "chinedu",
    days_ago: 13,
    scenario: "APPROVED_AFTER_HOLD",
    flags: ["SAME_NETWORK_AS_REFERRER"],
    note: "Siblings sharing a home connection - called both, documents check out.",
  },
  { key: "daniel", first_name: "Daniel", last_name: "Okoro", gender: "MALE", city: "Port Harcourt", state: "Rivers", referrer: "chinedu", days_ago: 1, scenario: "SIGNED_UP", channel: "ONBOARDING" },
];

const pad = (value: number, length: number) => String(value).padStart(length, "0");
const emailFor = (referee: DemoReferee) => `${referee.first_name}.${referee.last_name}.demo@${DEMO_DOMAIN}`.toLowerCase();

const verificationFor = (scenario: Scenario, submittedRecently: boolean): $Enums.DriverVerificationStatus => {
  if (scenario === "SIGNED_UP") return "UNSUBMITTED";
  if (scenario === "REVERSED") return "REJECTED";
  if (scenario === "AUTO_REJECTED" || scenario === "ADMIN_REJECTED" || submittedRecently) return "PENDING";

  return "APPROVED";
};

const reset = async (walletService: WalletService) => {
  const demoUsers = await prisma.user.findMany({ where: { email: { endsWith: `.demo@${DEMO_DOMAIN}` } }, select: { id: true } });
  const ids = demoUsers.map(user => user.id);
  const referrals = await prisma.referral.findMany({ where: { refereeId: { in: ids } }, select: { walletTransactionId: true, reversalTransactionId: true } });
  const transactionIds = referrals.flatMap(row => [row.walletTransactionId, row.reversalTransactionId]).filter((id): id is string => !!id);
  const wallets = await prisma.walletTransaction.findMany({ where: { id: { in: transactionIds } }, select: { walletId: true }, distinct: ["walletId"] });

  await prisma.referral.deleteMany({ where: { refereeId: { in: ids } } });
  await prisma.walletTransaction.deleteMany({ where: { id: { in: transactionIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });

  for (const { walletId } of wallets) await walletService.rebuildBalances(walletId);

  console.log(`🧹 Removed ${ids.length} demo referee(s) and ${transactionIds.length} referral ledger row(s).`);
};

const createReferee = async (referee: DemoReferee, index: number, password: string, joinedAt: Date) => {
  const submittedAt = new Date(joinedAt.getTime() + DAY);
  const submittedRecently = Date.now() - submittedAt.getTime() < 2 * DAY;
  const verification = verificationFor(referee.scenario, submittedRecently);
  const submitted = verification !== "UNSUBMITTED";
  const reviewed = verification === "APPROVED" || verification === "REJECTED";
  const reviewedAt = new Date(submittedAt.getTime() + DAY);

  return prisma.user.create({
    data: {
      email: emailFor(referee),
      password,
      role: "DRIVER",
      account_status: "ACTIVE",
      first_name: referee.first_name,
      last_name: referee.last_name,
      gender: referee.gender,
      has_validated_email: true,
      terms_accepted_at: joinedAt,
      phone_no: `+234816500${pad(index + 1, 4)}`,
      country: "Nigeria",
      state_of_residence: referee.state,
      city: referee.city,
      timezone: "Africa/Lagos",
      createdAt: joinedAt,
      driver_profile: {
        create: {
          driver_type: index % 3 ? "PRIVATE_DRIVER" : "CORPORATE_DRIVER",
          transmission: "BOTH",
          years_of_experience: 3 + (index % 9),
          license_number: `DEM${pad(index + 1, 5)}AA${pad(index + 11, 2)}`,
          expected_monthly_rate: (150000 + (index % 6) * 25000) * 100,
          verification_status: verification,
          is_discoverable: verification === "APPROVED",
          onboarding_step: submitted ? "REVIEW" : referee.channel === "ONBOARDING" ? "REVIEW" : "DOCUMENTS",
          onboarding_completed_at: submitted ? submittedAt : null,
          createdAt: joinedAt,
        },
      },
      documents: submitted
        ? {
            create: DOCUMENTS.map(type => {
              const rejected = verification === "REJECTED" && type === "DRIVERS_LICENCE";

              return {
                type,
                url: PLACEHOLDER_IMAGE,
                public_id: `seed/${emailFor(referee)}/${type.toLowerCase()}`,
                file_name: `${type.toLowerCase()}.jpg`,
                mime_type: "image/jpeg",
                status: rejected ? ("REJECTED" as const) : verification === "PENDING" ? ("PENDING" as const) : ("APPROVED" as const),
                rejection_reason: rejected ? "The licence number on this card doesn't match FRSC records. Upload a photo of your current licence." : null,
                reviewed_at: reviewed ? reviewedAt : null,
              };
            }),
          }
        : undefined,
      driver_verification: {
        create: {
          status: verification,
          submitted_at: submitted ? submittedAt : null,
          reviewed_at: reviewed ? reviewedAt : null,
          attempts: submitted ? 1 : 0,
        },
      },
    },
    select: { id: true, first_name: true, last_name: true, createdAt: true },
  });
};

const writeReward = async (walletService: WalletService, referrerId: string, name: string, rewardedAt: Date) => {
  const wallet = await walletService.ensure(referrerId, REFERRAL_CONFIG.currency);
  const availableAt = new Date(rewardedAt.getTime() + REFERRAL_CONFIG.holdHours * 60 * 60 * 1000);

  return prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "REFERRAL_BONUS",
      status: availableAt.getTime() <= Date.now() ? "AVAILABLE" : "PENDING",
      amount_minor: REFERRAL_CONFIG.rewardMinor,
      currency: REFERRAL_CONFIG.currency,
      description: `Referral reward · ${name}`,
      reference: generateReference("TXN"),
      available_at: availableAt,
      createdAt: rewardedAt,
    },
  });
};

export const seedDemoReferrals = async () => {
  if (process.env.NODE_ENV === "production") throw new Error("Demo referral seeding never runs in production.");

  const walletService = new WalletService();
  const codeService = new ReferralCodeService();

  if (process.argv.includes("--reset")) await reset(walletService);

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", anonymised_at: null }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const people = new Map<string, { id: string; createdAt: Date }>();

  for (const [key, email] of Object.entries(REFERRERS)) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, createdAt: true } });

    if (!user) throw new Error(`Referrer ${email} not found - run npm run seed:drivers first.`);

    people.set(key, user);
  }

  const password = process.env.SEED_DEMO_PASSWORD || generateRandomPassword();
  const hashed = await hashPassword(password);
  const created: { name: string; email: string; referred_by: string; status: string }[] = [];
  const touchedWallets = new Set<string>();

  for (const [index, referee] of REFEREES.entries()) {
    const referrer = people.get(referee.referrer);

    if (!referrer) throw new Error(`Referee ${referee.key} names unknown referrer ${referee.referrer}`);

    const existing = await prisma.user.findUnique({ where: { email: emailFor(referee) }, select: { id: true, createdAt: true } });

    if (existing) {
      people.set(referee.key, existing);
      continue;
    }

    const code = await codeService.ensureCode(referrer.id);
    // A referral code can't predate its owner's account, so the referee always joins after the referrer.
    const joinedAt = new Date(Math.max(Date.now() - referee.days_ago * DAY, referrer.createdAt.getTime() + DAY));
    const user = await createReferee(referee, index, hashed, joinedAt);
    const name = maskedName(user);
    const qualifiedAt = new Date(joinedAt.getTime() + DAY);
    const reviewedAt = new Date(qualifiedAt.getTime() + DAY / 2);
    const flags = referee.flags ?? [];
    const riskScore = Math.min(100, flags.reduce((total, flag) => total + (RISK_FLAGS[flag as RiskFlag]?.weight ?? 0), 0));

    people.set(referee.key, user);

    const base = {
      referrerId: referrer.id,
      refereeId: user.id,
      code,
      channel: referee.channel ?? ("SIGNUP" as const),
      risk_flags: flags,
      risk_score: riskScore,
      createdAt: referee.channel === "ONBOARDING" ? new Date(joinedAt.getTime() + DAY / 3) : joinedAt,
    };

    if (referee.scenario === "SIGNED_UP") {
      await prisma.referral.create({ data: { ...base, status: "SIGNED_UP" } });
    } else if (referee.scenario === "HELD") {
      await prisma.referral.create({ data: { ...base, status: "HELD", qualified_at: qualifiedAt } });
    } else if (referee.scenario === "AUTO_REJECTED") {
      await prisma.referral.create({ data: { ...base, status: "REJECTED", qualified_at: qualifiedAt, review_note: "Refused automatically by the referral checks" } });
    } else if (referee.scenario === "ADMIN_REJECTED") {
      await prisma.referral.create({ data: { ...base, status: "REJECTED", qualified_at: qualifiedAt, reviewedById: admin?.id, reviewed_at: reviewedAt, review_note: referee.note } });
    } else {
      const rewardedAt = referee.scenario === "APPROVED_AFTER_HOLD" ? reviewedAt : qualifiedAt;
      const reward = await writeReward(walletService, referrer.id, name, rewardedAt);
      const review = referee.scenario === "APPROVED_AFTER_HOLD" ? { reviewedById: admin?.id, reviewed_at: reviewedAt, review_note: referee.note } : {};
      let reversal: { reversalTransactionId: string; reviewedById?: string; reviewed_at: Date; review_note?: string } | undefined;

      if (referee.scenario === "REVERSED") {
        const reversedAt = new Date(reward.available_at!.getTime() + 2 * DAY);
        const clawback = await prisma.walletTransaction.create({
          data: {
            walletId: reward.walletId,
            type: "ADJUSTMENT",
            status: "PAID_OUT",
            amount_minor: -REFERRAL_CONFIG.rewardMinor,
            currency: REFERRAL_CONFIG.currency,
            description: `Referral reward reversed · ${name}`,
            reference: generateReference("TXN"),
            available_at: reversedAt,
            createdAt: reversedAt,
          },
        });

        reversal = { reversalTransactionId: clawback.id, reviewedById: admin?.id, reviewed_at: reversedAt, review_note: referee.note };
      }

      await prisma.referral.create({
        data: {
          ...base,
          status: reversal ? "REVERSED" : "REWARDED",
          qualified_at: qualifiedAt,
          rewarded_at: rewardedAt,
          reward_minor: REFERRAL_CONFIG.rewardMinor,
          currency: REFERRAL_CONFIG.currency,
          walletTransactionId: reward.id,
          ...review,
          ...reversal,
        },
      });

      touchedWallets.add(reward.walletId);
    }

    await walletService.ensure(user.id, REFERRAL_CONFIG.currency);
    created.push({ name: `${referee.first_name} ${referee.last_name}`, email: emailFor(referee), referred_by: referee.referrer, status: referee.scenario });
  }

  for (const walletId of touchedWallets) await walletService.rebuildBalances(walletId);

  if (!created.length) {
    console.log("Demo referrals already seeded. Pass --reset to rebuild them.");
    return;
  }

  console.log(`🌱 Seeded ${created.length} demo referee(s).`);
  console.log(`🔑 Shared password: ${password}`);
  console.table(created);
};

seedDemoReferrals()
  .catch(error => {
    console.error("❌ Seeding demo referrals failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
