import type { $Enums } from "../../generated/prisma/client";
import { REFERRAL_PERSON, ReferralRepository } from "../../repositories/referral/referral.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { NotFoundError } from "../../helper/errors";

const RANGE_DAYS: Record<string, number | null> = { "7d": 7, "30d": 30, "90d": 90, all: null };
const DAY = 24 * 60 * 60 * 1000;
const MAX_NETWORK_DEPTH = 4;
const MAX_NETWORK_NODES = 400;

type Person = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  createdAt: Date;
  driver_profile: { verification_status: $Enums.DriverVerificationStatus; onboarding_step: $Enums.OnboardingStep; referral_code: string | null } | null;
};

export type NetworkNode = {
  id: string;
  name: string;
  status: "root" | "rewarded" | "held" | "onboarding" | "signed_up" | "reversed";
  verification_status: $Enums.DriverVerificationStatus | null;
  joined_at: Date;
  children: NetworkNode[];
};

const fullName = (person: { first_name: string | null; last_name: string | null }) => [person.first_name, person.last_name].filter(Boolean).join(" ") || "Unnamed driver";

const nodeStatus = (status: $Enums.ReferralStatus, person: Person): NetworkNode["status"] => {
  if (status === "REWARDED") return "rewarded";
  if (status === "HELD") return "held";
  if (status === "REJECTED" || status === "REVERSED") return "reversed";

  return person.driver_profile && person.driver_profile.onboarding_step !== "PERSONAL_INFORMATION" ? "onboarding" : "signed_up";
};

export class AdminReferralInsightsService {
  private referralRepo = new ReferralRepository();
  private userRepo = new UserRepository();

  async overview(range = "30d") {
    const days = RANGE_DAYS[range] ?? 30;
    const now = Date.now();
    const from = days ? new Date(now - days * DAY) : undefined;
    const previousFrom = days ? new Date(now - 2 * days * DAY) : undefined;
    const cohort = (extra = {}) => this.referralRepo.countCreated(from, undefined, extra);

    const [signups, previousSignups, emailVerified, startedOnboarding, submitted, approved, rewardsPaid, activeReferrers, held, weekly] = await Promise.all([
      cohort(),
      days ? this.referralRepo.countCreated(previousFrom, from) : Promise.resolve(null),
      cohort({ referee: { has_validated_email: true } }),
      cohort({ referee: { driver_profile: { OR: [{ onboarding_step: { not: "PERSONAL_INFORMATION" } }, { onboarding_completed_at: { not: null } }] } } }),
      cohort({ qualified_at: { not: null } }),
      cohort({ referee: { driver_profile: { verification_status: "APPROVED" } } }),
      this.referralRepo.sumRewards(from),
      this.referralRepo.countActiveReferrers(from),
      this.referralRepo.countCreated(undefined, undefined, { status: "HELD" }),
      this.weekly(),
    ]);

    return {
      range: days ? range : "all",
      kpis: {
        signups,
        signups_change_pct: previousSignups ? Math.round(((signups - previousSignups) / previousSignups) * 100) : null,
        qualified: submitted,
        conversion_pct: signups ? Math.round((submitted / signups) * 100) : 0,
        rewards_paid_minor: rewardsPaid,
        active_referrers: activeReferrers,
        held_for_review: held,
      },
      funnel: [
        { key: "signed_up", label: "Signed up", count: signups },
        { key: "email_verified", label: "Email verified", count: emailVerified },
        { key: "started_onboarding", label: "Started onboarding", count: startedOnboarding },
        { key: "submitted", label: "Submitted", count: submitted },
        { key: "approved", label: "Approved", count: approved },
      ],
      weekly,
      currency: "NGN",
    };
  }

  private async weekly() {
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const start = new Date(today - (((now.getUTCDay() + 6) % 7) + 11 * 7) * DAY);

    // Postgres truncates weeks in UTC, so the buckets here are UTC Mondays too or no key ever matches.
    const rows = await this.referralRepo.weeklySignups(start);
    const byWeek = new Map(rows.map(row => [new Date(row.week).toISOString().slice(0, 10), Number(row.total)]));

    return Array.from({ length: 12 }, (_, index) => {
      const week = new Date(start.getTime() + index * 7 * DAY);
      const key = week.toISOString().slice(0, 10);

      return { week_start: key, count: byWeek.get(key) ?? 0 };
    });
  }

  async network(limit = 6) {
    const topIds = await this.referralRepo.topReferrerIds(Math.min(Math.max(limit, 1), 50) * 2);
    const rootIds: string[] = [];

    for (const id of topIds) {
      const ancestor = await this.topAncestor(id);
      if (!rootIds.includes(ancestor)) rootIds.push(ancestor);
      if (rootIds.length >= limit) break;
    }

    if (!rootIds.length) return { roots: [], truncated: false };

    const roots = await this.userRepo.findManyByIds(rootIds, REFERRAL_PERSON);
    const nodes = new Map<string, NetworkNode>();

    for (const person of roots) nodes.set(person.id, { id: person.id, name: fullName(person), status: "root", verification_status: person.driver_profile?.verification_status ?? null, joined_at: person.createdAt, children: [] });

    let frontier = rootIds;
    let truncated = false;

    for (let depth = 0; depth < MAX_NETWORK_DEPTH && frontier.length; depth++) {
      const edges = await this.referralRepo.edgesFrom(frontier);
      const next: string[] = [];

      for (const edge of edges) {
        if (nodes.has(edge.refereeId)) continue;
        if (nodes.size >= MAX_NETWORK_NODES) {
          truncated = true;
          break;
        }

        const child: NetworkNode = {
          id: edge.refereeId,
          name: fullName(edge.referee),
          status: nodeStatus(edge.status, edge.referee),
          verification_status: edge.referee.driver_profile?.verification_status ?? null,
          joined_at: edge.createdAt,
          children: [],
        };

        nodes.get(edge.referrerId)?.children.push(child);
        nodes.set(child.id, child);
        next.push(child.id);
      }

      frontier = next;
    }

    return { roots: rootIds.map(id => nodes.get(id)).filter((node): node is NetworkNode => !!node), truncated };
  }

  private async topAncestor(userId: string) {
    let cursor = userId;

    for (let hop = 0; hop < MAX_NETWORK_DEPTH * 2; hop++) {
      const parent = await this.referralRepo.findReferrerOf(cursor);
      if (!parent) break;
      cursor = parent.referrerId;
    }

    return cursor;
  }

  async leaderboard(limit = 8) {
    const rows = await this.referralRepo.leaderboard(Math.min(Math.max(limit, 1), 50));
    const ids = rows.map(row => row.referrerId);
    const [people, totals] = await Promise.all([this.userRepo.findManyByIds(ids, REFERRAL_PERSON), this.referralRepo.totalsByReferrer(ids)]);

    return rows.map(row => {
      const person = people.find(candidate => candidate.id === row.referrerId);

      return {
        user_id: row.referrerId,
        name: person ? fullName(person) : "Unknown driver",
        code: person?.driver_profile?.referral_code ?? null,
        rewarded: row._count._all,
        total: totals.find(total => total.referrerId === row.referrerId)?._count._all ?? row._count._all,
      };
    });
  }

  async referrer(userId: string) {
    const [person] = await this.userRepo.findManyByIds([userId], REFERRAL_PERSON);

    if (!person) throw new NotFoundError("Driver not found");

    const chain: { id: string; name: string }[] = [];
    let cursor = userId;

    for (let hop = 0; hop < 5; hop++) {
      const parent = await this.referralRepo.findReferrerOf(cursor);

      if (!parent) break;

      chain.unshift({ id: parent.referrerId, name: fullName(parent.referrer) });
      cursor = parent.referrerId;
    }

    const [counts, { referrals }] = await Promise.all([this.referralRepo.statusCountsForReferrer(userId), this.referralRepo.findForReferrer(userId, { page: 1, limit: 100 })]);

    return {
      id: person.id,
      name: fullName(person),
      code: person.driver_profile?.referral_code ?? null,
      verification_status: person.driver_profile?.verification_status ?? null,
      joined_at: person.createdAt,
      location: [person.city, person.state_of_residence].filter(Boolean).join(", ") || null,
      chain,
      total: counts.reduce((total, row) => total + row._count._all, 0),
      earned_minor: counts.find(row => row.status === "REWARDED")?._sum.reward_minor ?? 0,
      referrals: referrals.map(referral => ({
        id: referral.id,
        status: referral.status,
        referee_id: referral.refereeId,
        name: fullName(referral.referee),
        joined_at: referral.createdAt,
        reward_minor: referral.reward_minor,
      })),
    };
  }
}
