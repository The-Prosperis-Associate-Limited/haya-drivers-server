import { prisma } from "../../helper/prisma";

const INACTIVITY_TTL_DAYS = 90;

/*
  Accounts nobody has signed into (or refreshed a session on) for 90 days go
  dormant: DEACTIVATED + deactivated_for_inactivity, and dormant drivers leave
  the marketplace. Signing in again offers reactivation - admins are exempt,
  their access is managed from the team screen.
*/
export const deactivateInactiveAccounts = async () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - INACTIVITY_TTL_DAYS);

  const where = {
    account_status: "ACTIVE" as const,
    role: { not: "ADMIN" as const },
    lastLogin: { lt: cutoff },
  };

  // Profiles first - once the user rows flip, the shared `where` no longer
  // matches them.
  const [, users] = await prisma.$transaction([
    prisma.driverProfile.updateMany({
      where: { user: where, is_discoverable: true },
      data: { is_discoverable: false },
    }),
    prisma.user.updateMany({
      where,
      data: { account_status: "DEACTIVATED", deactivated_for_inactivity: true },
    }),
  ]);

  return `${users.count} account(s) deactivated for ${INACTIVITY_TTL_DAYS}-day inactivity`;
};
