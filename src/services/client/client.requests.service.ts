import { ForbiddenError, NotFoundError } from "../../helper/errors";
import { StaffingRequestRepository } from "../../repositories/booking/staffingRequest.repository";
import { toMinorUnits } from "../../utils/money";
import { paginate, parsePagination } from "../../utils/pagination";
import { generateReference } from "../../utils/reference";
import type { CreateStaffingRequestInput } from "../../utils/types/requestValidatorSchema";
import type { DriverSearchInput } from "../../utils/types/bookingValidatorSchema";
import { ClientDriverSearchService } from "./client.driverSearch.service";

export class ClientRequestsService {
  private requestRepo = new StaffingRequestRepository();
  private driverSearch = new ClientDriverSearchService();

  async create(clientId: string, data: CreateStaffingRequestInput) {
    const { budget, ...rest } = data;

    return this.requestRepo.create({
      ...rest,
      clientId,
      reference: generateReference("REQ"),
      budget: toMinorUnits(budget),
    });
  }

  async list(clientId: string, query: Record<string, unknown>) {
    const pagination = parsePagination(query);

    const { requests, total } = await this.requestRepo.findForClient(clientId, pagination);
    const counts = await this.requestRepo.applicationCounts(requests.map(request => request.id));

    const withCounts = requests.map(request => ({
      ...request,
      applicants: counts.get(request.id)?.applicants ?? 0,
      shortlisted: counts.get(request.id)?.shortlisted ?? 0,
    }));

    return paginate(withCounts, total, pagination);
  }

  async close(clientId: string, reference: string) {
    const request = await this.ownedRequest(clientId, reference);

    if (request.status === "CLOSED") return request;

    return this.requestRepo.update(request.id, { status: "CLOSED", closed_at: new Date() });
  }

  // Applicants come first; beneath them, verified drivers matching the
  // request's criteria — the budget cap never excludes a driver whose rate is
  // unset, the search repo already treats an unknown rate as affordable.
  async matches(clientId: string, reference: string, query: Record<string, unknown>) {
    const request = await this.ownedRequest(clientId, reference);

    const [applicants, matched] = await Promise.all([
      this.requestRepo.applicantsForRequest(request.id),
      this.driverSearch.search(query, {
        driver_type: request.driver_type,
        state: request.state,
        budget_max: request.budget,
      } as DriverSearchInput),
    ]);

    return { request, applicants, matched };
  }

  private async ownedRequest(clientId: string, reference: string) {
    const request = await this.requestRepo.findByReference(reference);

    if (!request) throw new NotFoundError("Request not found");
    if (request.clientId !== clientId) throw new ForbiddenError("That request belongs to another client");

    return request;
  }
}
