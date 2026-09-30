import type { $Enums } from "../../generated/prisma/client";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { WalletRepository } from "../../repositories/earnings/wallet.repository";
import { WalletTransactionRepository } from "../../repositories/earnings/walletTransaction.repository";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { prisma } from "../../helper/prisma";
import { paginate, parsePagination } from "../../utils/pagination";
import { ActivityService } from "../shared/activity.service";
import { NotificationService } from "../shared/notification.service";

export class AdminUsersService {
  private userRepo = new UserRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private walletRepo = new WalletRepository();
  private walletTransactionRepo = new WalletTransactionRepository();
  private notificationService = new NotificationService();
  private activityService = new ActivityService();

  async list(query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { users, total } = await this.userRepo.findMany({
      ...pagination,
      search: query.search as string | undefined,
      role: query.role as $Enums.UserRole | undefined,
      status: query.status as $Enums.AccountStatus | undefined,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_no: true,
        profile_pic: true,
        role: true,
        account_status: true,
        has_validated_email: true,
        lastLogin: true,
        createdAt: true,
        driver_profile: { select: { driver_type: true, trust_score: true, verification_status: true } },
        client_profile: { select: { client_type: true, organisation_name: true } },
      },
    });

    return paginate(users, total, pagination);
  }

  async stats(role?: $Enums.UserRole) {
    if (role === "CLIENT") {
      const [total, active, suspended, organisations] = await Promise.all([
        this.userRepo.count({ role: "CLIENT" }),
        this.userRepo.count({ role: "CLIENT", account_status: "ACTIVE" }),
        this.userRepo.count({ role: "CLIENT", account_status: "SUSPENDED" }),
        this.userRepo.count({ role: "CLIENT", client_profile: { client_type: "ORGANISATION" } }),
      ]);

      return { total, active, suspended, organisations };
    }

    const [total, approved, pending, suspended] = await Promise.all([
      this.userRepo.count({ role: "DRIVER" }),
      this.driverProfileRepo.countByStatus("APPROVED"),
      this.driverProfileRepo.countByStatus("PENDING"),
      this.userRepo.count({ role: "DRIVER", account_status: "SUSPENDED" }),
    ]);

    return { total, active: approved, pending_approval: pending, suspended };
  }

  async get(id: string) {
    const user = await this.userRepo.findById(id, {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      phone_no: true,
      whatsapp_number: true,
      profile_pic: true,
      bio: true,
      role: true,
      gender: true,
      date_of_birth: true,
      marital_status: true,
      account_status: true,
      has_validated_email: true,
      country: true,
      state_of_residence: true,
      city: true,
      address: true,
      createdAt: true,
      lastLogin: true,
      driver_profile: { include: { work_experiences: { orderBy: { started_at: "desc" } }, guarantors: true, reference: true } },
      driver_verification: true,
      client_profile: true,
    });

    if (!user) throw new NotFoundError("Account not found");

    return user;
  }

  async wallet(id: string, query: Record<string, unknown>) {
    const user = await this.userRepo.findById(id, { id: true, role: true });

    if (!user) throw new NotFoundError("Account not found");

    const wallet = await this.walletRepo.findByUserId(id);

    if (!wallet) {
      return { wallet: null, transactions: paginate([], 0, parsePagination(query)) };
    }

    const pagination = parsePagination(query);
    const { transactions, total } = await this.walletTransactionRepo.findForWallet(wallet.id, {
      ...pagination,
      status: query.status as $Enums.WalletTransactionStatus | undefined,
      type: query.type as $Enums.WalletTransactionType | undefined,
    });

    const { dva_customer_code: _, ...safeWallet } = wallet;

    return { wallet: safeWallet, transactions: paginate(transactions, total, pagination) };
  }

  async activities(id: string, query: Record<string, unknown>) {
    const user = await this.userRepo.findById(id, { id: true });

    if (!user) throw new NotFoundError("Account not found");

    return this.activityService.listForUser(id, query);
  }

  /*
    Suspension takes a driver out of client search in the same call. A suspended
    driver who is still listed would keep receiving requests they cannot accept,
    which is worse for the client than for them.
  */
  async setAccountStatus(id: string, status: $Enums.AccountStatus, reason?: string) {
    const user = await this.userRepo.findById(id, { role: true });

    if (!user) throw new NotFoundError("Account not found");

    await this.userRepo.updateUser(id, {
      account_status: status,
      ...(status !== "ACTIVE" && { sessions_valid_from: new Date() }),
    });

    if (user.role === "DRIVER") {
      const profile = await this.driverProfileRepo.findByUserId(id, { verification_status: true });

      if (profile) {
        await this.driverProfileRepo.update(id, { is_discoverable: status === "ACTIVE" && profile.verification_status === "APPROVED" });
      }
    }

    await this.notificationService.notify({
      recipientId: id,
      type: status === "ACTIVE" ? "SUCCESS" : "WARNING",
      title: status === "ACTIVE" ? "Account reactivated" : "Account suspended",
      message: status === "ACTIVE" ? "Your account is active again." : (reason ?? "Your account has been suspended. Contact support for details."),
    });

    await this.activityService.record(id, status === "ACTIVE" ? "ACCOUNT_REACTIVATED" : "ACCOUNT_SUSPENDED", `Account ${status.toLowerCase()}`, reason);

    return this.get(id);
  }

  /*
    Hard delete is for accounts with no financial history - spam signups,
    abandoned onboarding, test accounts. Bookings and wallet transactions are
    the money ledger for BOTH parties, so an account woven into them cannot be
    erased without destroying the other side's records; suspension is the tool
    for those.
  */
  async remove(id: string) {
    const user = await this.userRepo.findById(id, { id: true });

    if (!user) throw new NotFoundError("Account not found");

    const bookings = await prisma.booking.count({ where: { OR: [{ clientId: id }, { driverId: id }] } });

    if (bookings > 0) {
      throw new BadRequestError("This account has booking history that other accounts' records depend on - suspend it instead of deleting");
    }

    try {
      return await this.userRepo.deleteUser(id);
    } catch (error) {
      // Any other restricted relation surfaces the same way - never a 500.
      if ((error as { code?: string }).code === "P2003") {
        throw new BadRequestError("This account has records that other accounts depend on - suspend it instead of deleting");
      }
      throw error;
    }
  }
}
