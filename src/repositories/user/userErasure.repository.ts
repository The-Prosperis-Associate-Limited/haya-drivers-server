import { prisma } from "../../helper/prisma";

export class UserErasureRepository {
  async anonymise(userId: string) {
    const now = new Date();

    return prisma.$transaction([
      prisma.emailOtp.deleteMany({ where: { userId } }),
      prisma.accountSignal.deleteMany({ where: { userId } }),
      prisma.deviceToken.deleteMany({ where: { userId } }),
      prisma.pushSubscription.deleteMany({ where: { userId } }),
      prisma.notificationPreference.deleteMany({ where: { userId } }),
      prisma.notification.deleteMany({ where: { recipientId: userId } }),
      prisma.clientProfile.deleteMany({ where: { userId } }),
      prisma.driverProfile.deleteMany({ where: { userId } }),
      prisma.driverVerification.deleteMany({ where: { userId } }),
      prisma.driverDocument.deleteMany({ where: { userId } }),
      prisma.courseEnrollment.deleteMany({ where: { userId } }),
      prisma.certification.deleteMany({ where: { userId } }),
      // An account a payout went to stays: the payout record has to show where the money was sent.
      prisma.bankAccount.deleteMany({ where: { userId, payouts: { none: {} } } }),
      prisma.wallet.updateMany({ where: { userId }, data: { dva_account_name: null } }),
      prisma.staffingRequest.updateMany({ where: { clientId: userId, status: "OPEN" }, data: { status: "CLOSED", closed_at: now } }),
      prisma.requestApplication.updateMany({ where: { driverId: userId, status: { in: ["APPLIED", "SHORTLISTED"] } }, data: { status: "WITHDRAWN" } }),
      prisma.user.update({
        where: { id: userId },
        data: {
          first_name: "Deleted",
          last_name: "user",
          email: `deleted-${userId}@anonymised.invalid`,
          password: null,
          phone_no: null,
          whatsapp_number: null,
          profile_pic: null,
          bio: null,
          gender: null,
          date_of_birth: null,
          marital_status: null,
          country: null,
          state_of_residence: null,
          city: null,
          address: null,
          timezone: null,
          googleId: null,
          authProvider: "PASSWORD",
          isLocked: true,
          account_status: "DEACTIVATED",
          deactivated_for_inactivity: false,
          sessions_valid_from: now,
          anonymised_at: now,
        },
        select: { id: true, anonymised_at: true },
      }),
    ]);
  }
}
