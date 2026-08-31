import type { $Enums } from "../../generated/prisma/client";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { NotFoundError } from "../../helper/errors";
import { paginate, parsePagination } from "../../utils/pagination";
import { ActivityService } from "../shared/activity.service";
import { NotificationService } from "../shared/notification.service";

export class AdminUsersService {
  private userRepo = new UserRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private notificationService = new NotificationService();
  private activityService = new ActivityService();

  async list(query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { users, total } = await this.userRepo.findMany({
      ...pagination,
      search: query.search as string | undefined,
      role: query.role as $Enums.UserRole | undefined,
      status: query.status as $Enums.AccountStatus | undefined,
    });

    return paginate(users, total, pagination);
  }

  async get(id: string) {
    const user = await this.userRepo.findById(id, {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      phone_no: true,
      profile_pic: true,
      role: true,
      account_status: true,
      has_validated_email: true,
      country: true,
      state_of_residence: true,
      createdAt: true,
      lastLogin: true,
      driver_profile: true,
      client_profile: true,
    });

    if (!user) throw new NotFoundError("Account not found");

    return user;
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

  async remove(id: string) {
    const user = await this.userRepo.findById(id, { id: true });

    if (!user) throw new NotFoundError("Account not found");

    return this.userRepo.deleteUser(id);
  }
}
