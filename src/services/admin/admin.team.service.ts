import type { $Enums } from "../../generated/prisma/client";
import { BadRequestError, ConflictError, NotFoundError } from "../../helper/errors";
import { hashPassword } from "../../helper/hashPassword";
import { AdminProfileRepository } from "../../repositories/user/adminProfile.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { generateTemporaryPassword } from "../../utils/reference";
import { surfaceUrlFor } from "../../utils/surfaceUrl";
import type { InviteAdminInput, UpdateAdminRoleInput } from "../../utils/types/adminValidatorSchema";
import { queueEmail } from "../../workers/globalEmailQueueHandler";
import { JOB_KEY } from "../../workers/jobKeys";
import { ActivityService } from "../shared/activity.service";
import { paginate, parsePagination } from "../../utils/pagination";

export class AdminTeamService {
  private userRepo = new UserRepository();
  private adminProfileRepo = new AdminProfileRepository();
  private activityService = new ActivityService();

  async list(query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const { admins, total } = await this.adminProfileRepo.listTeam({ ...pagination, search: query.search as string | undefined });

    return paginate(admins, total, pagination);
  }

  /*
    The temporary password is returned to the inviter exactly once and never
    emailed — the invite email carries only a sign-in link. must_change_password
    locks every /api/admin route until the invitee rotates it, so a leaked
    temporary credential has the shortest possible life.
  */
  async invite(inviterId: string, data: InviteAdminInput) {
    const existing = await this.userRepo.findByEmail(data.email);

    if (existing) throw new ConflictError("An account with this email already exists");

    const inviter = await this.userRepo.findById(inviterId, { first_name: true, last_name: true, email: true });

    const [first_name, ...rest] = data.full_name.split(/\s+/);
    const temporaryPassword = generateTemporaryPassword();

    const user = await this.userRepo.createUser({
      first_name,
      last_name: rest.join(" ") || null,
      email: data.email,
      password: await hashPassword(temporaryPassword),
      role: "ADMIN",
      // The inviter vouches for the address; a verification loop would only stall the invite.
      has_validated_email: true,
      terms_accepted_at: new Date(),
    });

    await this.adminProfileRepo.create({
      userId: user.id,
      admin_role: data.admin_role,
      must_change_password: true,
      invited_by: inviterId,
    });

    await queueEmail(JOB_KEY.ADMIN_INVITE, {
      email: user.email,
      first_name: user.first_name ?? "there",
      inviter_name: [inviter?.first_name, inviter?.last_name].filter(Boolean).join(" ") || (inviter?.email as string) || "A TEGAT admin",
      role_label: this.roleLabel(data.admin_role),
      baseUrl: surfaceUrlFor("ADMIN"),
    });

    await this.activityService.record(user.id, "ADMIN_INVITED", "Admin invited", `Invited as ${this.roleLabel(data.admin_role)}`);

    return {
      admin: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, admin_role: data.admin_role },
      temporary_password: temporaryPassword,
    };
  }

  async updateRole(actorId: string, userId: string, data: UpdateAdminRoleInput) {
    if (actorId === userId) throw new BadRequestError("You cannot change your own role");

    const target = await this.requireAdmin(userId);
    const currentRole = target.admin_profile?.admin_role ?? "SUPER_ADMIN";

    if (currentRole === "SUPER_ADMIN" && data.admin_role !== "SUPER_ADMIN") {
      await this.requireAnotherSuperAdmin(userId, "You cannot demote the last super admin");
    }

    if (target.admin_profile) {
      await this.adminProfileRepo.updateByUserId(userId, { admin_role: data.admin_role });
    } else {
      await this.adminProfileRepo.create({ userId, admin_role: data.admin_role });
    }

    await this.activityService.record(userId, "ADMIN_ROLE_CHANGED", "Admin role changed", `${this.roleLabel(currentRole)} → ${this.roleLabel(data.admin_role)}`);

    return this.get(userId);
  }

  async setStatus(actorId: string, userId: string, status: $Enums.AccountStatus) {
    if (actorId === userId) throw new BadRequestError("You cannot suspend your own account");

    const target = await this.requireAdmin(userId);

    if (status !== "ACTIVE" && this.isSuper(target)) {
      await this.requireAnotherSuperAdmin(userId, "You cannot suspend the last super admin");
    }

    await this.userRepo.updateUser(userId, {
      account_status: status,
      ...(status !== "ACTIVE" && { sessions_valid_from: new Date() }),
    });

    await this.activityService.record(userId, status === "ACTIVE" ? "ACCOUNT_REACTIVATED" : "ACCOUNT_SUSPENDED", `Admin account ${status.toLowerCase()}`);

    return this.get(userId);
  }

  async remove(actorId: string, userId: string) {
    if (actorId === userId) throw new BadRequestError("You cannot remove your own account");

    const target = await this.requireAdmin(userId);

    if (this.isSuper(target)) {
      await this.requireAnotherSuperAdmin(userId, "You cannot remove the last super admin");
    }

    return this.userRepo.deleteUser(userId);
  }

  private async get(userId: string) {
    const user = await this.userRepo.findById(userId, {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      profile_pic: true,
      account_status: true,
      lastLogin: true,
      createdAt: true,
      admin_profile: true,
    });

    if (!user) throw new NotFoundError("Admin not found");

    return user;
  }

  private async requireAdmin(userId: string) {
    const user = await this.userRepo.findById(userId, { id: true, role: true });

    if (!user || user.role !== "ADMIN") throw new NotFoundError("Admin not found");

    const admin_profile = await this.adminProfileRepo.findByUserId(userId);

    return { id: userId, admin_profile };
  }

  private isSuper(user: { admin_profile: { admin_role: $Enums.AdminRole } | null }) {
    return !user.admin_profile || user.admin_profile.admin_role === "SUPER_ADMIN";
  }

  private async requireAnotherSuperAdmin(excludeUserId: string, message: string) {
    const remaining = await this.adminProfileRepo.countActiveSuperAdmins(excludeUserId);

    if (remaining === 0) throw new BadRequestError(message);
  }

  private roleLabel(role: $Enums.AdminRole) {
    const labels: Record<$Enums.AdminRole, string> = {
      SUPER_ADMIN: "Super Admin",
      FLEET_MANAGER: "Fleet Manager",
      FINANCE_OFFICER: "Finance Officer",
      SUPPORT_AGENT: "Support Agent",
      READ_ONLY: "Read only",
    };

    return labels[role];
  }
}
