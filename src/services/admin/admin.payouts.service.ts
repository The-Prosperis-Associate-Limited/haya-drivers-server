import type { $Enums } from "../../generated/prisma/client";
import { PayoutRepository } from "../../repositories/earnings/payout.repository";
import { NotFoundError } from "../../helper/errors";
import { paginate, parsePagination } from "../../utils/pagination";
import { PayoutService } from "../earnings/payout.service";

export class AdminPayoutsService {
  private payoutRepo = new PayoutRepository();
  private payoutService = new PayoutService();

  async queue(query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { payouts, total } = await this.payoutRepo.findQueue({ ...pagination, status: query.status as $Enums.PayoutStatus | undefined });

    return paginate(payouts, total, pagination);
  }

  async get(reference: string) {
    const payout = await this.payoutRepo.findByReference(reference);

    if (!payout) throw new NotFoundError("Payout not found");

    return payout;
  }

  // Settlement goes through PayoutService so a manual mark-as-failed reverses
  // the wallet exactly the way a provider webhook does.
  async settle(reference: string, status: $Enums.PayoutStatus, failureReason?: string) {
    return this.payoutService.settle(reference, status, failureReason);
  }
}
