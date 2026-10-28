import { BookingRepository } from "../../repositories/booking/booking.repository";
import { HireRequestRepository } from "../../repositories/booking/hireRequest.repository";
import { PayoutRepository } from "../../repositories/earnings/payout.repository";
import { WalletRepository } from "../../repositories/earnings/wallet.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { UserErasureRepository } from "../../repositories/user/userErasure.repository";
import { BadRequestError, NotFoundError } from "../../helper/errors";
import { ActivityService } from "../shared/activity.service";
import { CloudinaryService } from "../shared/cloudinary.service";
import { WalletService } from "../earnings/wallet.service";

export class AdminUserErasureService {
  private userRepo = new UserRepository();
  private erasureRepo = new UserErasureRepository();
  private bookingRepo = new BookingRepository();
  private hireRequestRepo = new HireRequestRepository();
  private payoutRepo = new PayoutRepository();
  private walletRepo = new WalletRepository();
  private walletService = new WalletService();
  private cloudinaryService = new CloudinaryService();
  private activityService = new ActivityService();

  /*
    Hard delete is for accounts with no financial history - spam signups,
    abandoned onboarding, test accounts. Bookings and wallet transactions are
    the money ledger for BOTH parties, so an account woven into them cannot be
    erased without destroying the other side's records; those are anonymised
    instead, and suspension stays the tool for keeping someone off the platform.
  */
  async remove(id: string) {
    const user = await this.userRepo.findById(id, { id: true, role: true, anonymised_at: true });

    if (!user) throw new NotFoundError("Account not found");
    if (user.anonymised_at) throw new BadRequestError("This account has already been deleted");

    if ((await this.bookingRepo.countForUser(id)) > 0) return this.anonymise(id, user.role);

    try {
      await this.userRepo.deleteUser(id);

      return { id, outcome: "DELETED" as const };
    } catch (error) {
      // Any other restricted relation means the account is woven into someone else's records.
      if ((error as { code?: string }).code === "P2003") return this.anonymise(id, user.role);
      throw error;
    }
  }

  private async anonymise(id: string, role: string) {
    if (role === "ADMIN") throw new BadRequestError("Admin accounts with history are removed from the team page, not deleted");

    await this.assertNothingInFlight(id);

    await this.erasureRepo.anonymise(id);

    const results = await Promise.allSettled(
      (["avatar", "documents", "guarantors", "certificates"] as const).map(folder => this.cloudinaryService.deleteFolder(id, role, folder)),
    );

    for (const result of results) {
      if (result.status === "rejected") console.error(`Anonymise ${id}: Cloudinary cleanup failed`, result.reason);
    }

    await this.activityService.record(id, "ACCOUNT_ANONYMISED", "Account anonymised", "Personal data erased; booking and payment records kept");

    return { id, outcome: "ANONYMISED" as const };
  }

  private async assertNothingInFlight(id: string) {
    if ((await this.bookingRepo.countOpenForUser(id)) > 0) {
      throw new BadRequestError("This account has bookings still open - cancel or complete them before deleting");
    }

    if ((await this.hireRequestRepo.countOpenForUser(id)) > 0) {
      throw new BadRequestError("This account has hire requests still in progress - decline or cancel them before deleting");
    }

    if (await this.payoutRepo.hasOpenPayout(id)) {
      throw new BadRequestError("This account has a payout in flight - wait for it to settle before deleting");
    }

    const wallet = await this.walletRepo.findByUserId(id);

    if (wallet) {
      const balances = await this.walletService.rebuildBalances(wallet.id);

      if (balances.available_minor !== 0 || balances.pending_minor !== 0) {
        throw new BadRequestError("This account still holds a wallet balance - pay it out or adjust it to zero before deleting");
      }
    }
  }
}
