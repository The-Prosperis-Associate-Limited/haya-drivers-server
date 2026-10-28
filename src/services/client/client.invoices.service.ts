import type { $Enums } from "../../generated/prisma/client";
import { HireRequestRepository } from "../../repositories/booking/hireRequest.repository";
import { paginate } from "../../utils/pagination";

export class ClientInvoicesService {
  private hireRepo = new HireRequestRepository();

  // VOID invoices belong to cancelled requests - listed for the record, never counted as owed.
  async list(clientId: string, query: { page: number; limit: number; status?: $Enums.HireInvoiceStatus }) {
    const [{ invoices, total }, totals] = await Promise.all([this.hireRepo.listInvoicesForClient(clientId, query), this.hireRepo.invoiceTotalsForClient(clientId)]);

    const sumOf = (...statuses: $Enums.HireInvoiceStatus[]) => totals.filter(group => statuses.includes(group.status)).reduce((sum, group) => sum + group.total_minor, 0);
    const countOf = (...statuses: $Enums.HireInvoiceStatus[]) => totals.filter(group => statuses.includes(group.status)).reduce((sum, group) => sum + group.count, 0);

    return {
      ...paginate(invoices, total, query),
      summary: {
        outstanding_minor: sumOf("UNPAID", "PAYMENT_REVIEW"),
        outstanding_count: countOf("UNPAID", "PAYMENT_REVIEW"),
        in_review_count: countOf("PAYMENT_REVIEW"),
        paid_minor: sumOf("PAID"),
        paid_count: countOf("PAID"),
      },
    };
  }
}
