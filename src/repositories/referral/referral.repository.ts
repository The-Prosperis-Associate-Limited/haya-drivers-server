import type { $Enums, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../helper/prisma";

export const REFERRAL_PERSON = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  profile_pic: true,
  city: true,
  state_of_residence: true,
  account_status: true,
  has_validated_email: true,
  createdAt: true,
  driver_profile: { select: { verification_status: true, onboarding_step: true, onboarding_completed_at: true, referral_code: true } },
} satisfies Prisma.UserSelect;

const WITH_PEOPLE = {
  referee: { select: REFERRAL_PERSON },
  referrer: { select: REFERRAL_PERSON },
  reviewedBy: { select: { id: true, first_name: true, last_name: true } },
  walletTransaction: { select: { id: true, status: true, reference: true, available_at: true } },
} satisfies Prisma.ReferralInclude;

export type ReferralWithPeople = Prisma.ReferralGetPayload<{ include: typeof WITH_PEOPLE }>;

export class ReferralRepository {
  async create(data: Prisma.ReferralUncheckedCreateInput) {
    return prisma.referral.create({ data });
  }

  async findByReferee(refereeId: string) {
    return prisma.referral.findUnique({ where: { refereeId }, include: WITH_PEOPLE });
  }

  async findById(id: string) {
    return prisma.referral.findUnique({ where: { id }, include: WITH_PEOPLE });
  }

  // Conditional on the current status so two concurrent submits or two admins cannot both move the same referral.
  async transition(id: string, from: $Enums.ReferralStatus[], data: Prisma.ReferralUncheckedUpdateInput, extra?: Prisma.ReferralWhereInput) {
    const { count } = await prisma.referral.updateMany({ where: { id, status: { in: from }, ...extra }, data });

    return count === 1;
  }

  async update(id: string, data: Prisma.ReferralUncheckedUpdateInput) {
    return prisma.referral.update({ where: { id }, data });
  }

  async countRewardedSince(referrerId: string, since: Date) {
    return prisma.referral.count({ where: { referrerId, status: "REWARDED", rewarded_at: { gte: since } } });
  }

  async refereesOf(referrerId: string) {
    return prisma.referral.findMany({
      where: { referrerId },
      select: { refereeId: true, referee: { select: { email: true } } },
    });
  }

  async findForReferrer(referrerId: string, params: { page: number; limit: number; status?: $Enums.ReferralStatus[] }) {
    const where: Prisma.ReferralWhereInput = { referrerId, ...(params.status && { status: { in: params.status } }) };

    const [referrals, total] = await Promise.all([
      prisma.referral.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: "desc" },
        include: { referee: { select: REFERRAL_PERSON } },
      }),
      prisma.referral.count({ where }),
    ]);

    return { referrals, total };
  }

  async statusCountsForReferrer(referrerId: string) {
    return prisma.referral.groupBy({ by: ["status"], where: { referrerId }, _count: { _all: true }, _sum: { reward_minor: true } });
  }

  async countSince(referrerId: string, since: Date) {
    return prisma.referral.count({ where: { referrerId, createdAt: { gte: since } } });
  }

  async list(params: { page: number; limit: number; status?: $Enums.ReferralStatus; search?: string; flagged?: boolean; referrerId?: string }) {
    const { page, limit, status, search, flagged, referrerId } = params;
    const person = (term: string): Prisma.UserWhereInput => ({
      OR: [{ first_name: { contains: term, mode: "insensitive" } }, { last_name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }],
    });

    const where: Prisma.ReferralWhereInput = {
      ...(status && { status }),
      ...(referrerId && { referrerId }),
      ...(flagged && { NOT: { risk_flags: { isEmpty: true } } }),
      ...(search && { OR: [{ code: { contains: search.toUpperCase() } }, { referee: person(search) }, { referrer: person(search) }] }),
    };

    const [referrals, total] = await Promise.all([
      prisma.referral.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" }, include: WITH_PEOPLE }),
      prisma.referral.count({ where }),
    ]);

    return { referrals, total };
  }

  async countCreated(from?: Date, to?: Date, where: Prisma.ReferralWhereInput = {}) {
    return prisma.referral.count({ where: { ...where, ...((from || to) && { createdAt: { ...(from && { gte: from }), ...(to && { lt: to }) } }) } });
  }

  async sumRewards(from?: Date) {
    const result = await prisma.referral.aggregate({
      where: { status: "REWARDED", ...(from && { rewarded_at: { gte: from } }) },
      _sum: { reward_minor: true },
    });

    return result._sum.reward_minor ?? 0;
  }

  async countActiveReferrers(from?: Date) {
    const rows = await prisma.referral.findMany({ where: from ? { createdAt: { gte: from } } : {}, distinct: ["referrerId"], select: { referrerId: true } });

    return rows.length;
  }

  async weeklySignups(since: Date) {
    return prisma.$queryRaw<{ week: Date; total: bigint }[]>`
      SELECT date_trunc('week', "createdAt") AS week, COUNT(*) AS total
      FROM "Referral"
      WHERE "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
  }

  async leaderboard(limit: number) {
    return prisma.referral.groupBy({
      by: ["referrerId"],
      where: { status: "REWARDED" },
      _count: { _all: true },
      orderBy: { _count: { referrerId: "desc" } },
      take: limit,
    });
  }

  async totalsByReferrer(referrerIds: string[]) {
    return prisma.referral.groupBy({ by: ["referrerId"], where: { referrerId: { in: referrerIds } }, _count: { _all: true } });
  }

  async topReferrerIds(limit: number) {
    const rows = await prisma.referral.groupBy({
      by: ["referrerId"],
      _count: { _all: true },
      orderBy: { _count: { referrerId: "desc" } },
      take: limit,
    });

    return rows.map(row => row.referrerId);
  }

  async edgesFrom(referrerIds: string[]) {
    return prisma.referral.findMany({
      where: { referrerId: { in: referrerIds } },
      orderBy: { createdAt: "asc" },
      select: { id: true, referrerId: true, refereeId: true, status: true, createdAt: true, referee: { select: REFERRAL_PERSON } },
    });
  }

  async findReferrerOf(userId: string) {
    return prisma.referral.findUnique({ where: { refereeId: userId }, select: { referrerId: true, referrer: { select: REFERRAL_PERSON } } });
  }
}
