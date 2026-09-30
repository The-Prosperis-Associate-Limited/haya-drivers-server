import { HireRequestRepository } from "../../repositories/booking/hireRequest.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { NotificationService } from "../shared/notification.service";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../helper/errors";

/*
  The driver's half of the availability handshake. They see engagement facts
  only - the client's identity is the product and stays out of every payload
  until the client has paid.
*/
export class DriverShortlistService {
  private hireRepo = new HireRequestRepository();
  private userRepo = new UserRepository();
  private notificationService = new NotificationService();

  async list(driverId: string) {
    return this.hireRepo.findPendingAssignmentsForDriver(driverId);
  }

  async respond(driverId: string, assignmentId: string, available: boolean) {
    const assignment = await this.hireRepo.findAssignmentById(assignmentId);

    if (!assignment) throw new NotFoundError("That shortlist entry was not found");
    if (assignment.driverId !== driverId) throw new ForbiddenError("That shortlist entry belongs to another driver");
    if (assignment.status !== "PENDING") throw new BadRequestError("You've already responded to this one");
    if (assignment.hire_request.status !== "PENDING_REVIEW") throw new BadRequestError("This engagement is no longer open");

    const updated = await this.hireRepo.respondToAssignment(assignmentId, available ? "CONFIRMED" : "DECLINED");

    const driver = await this.userRepo.findById(driverId, { first_name: true, last_name: true });
    const driverName = [driver?.first_name, driver?.last_name].filter(Boolean).join(" ") || "A driver";
    const adminIds = await this.userRepo.findAdminIds();

    await Promise.all(
      adminIds.map(recipientId =>
        this.notificationService.notify({
          recipientId,
          senderId: driverId,
          type: "BOOKING_STATUS",
          title: available ? "Driver confirmed availability" : "Driver not available",
          message: `${driverName} ${available ? "confirmed they're available" : "declined"} for ${assignment.hire_request.reference}.`,
          actionUrl: "/dashboard/hires",
          metadata: { reference: assignment.hire_request.reference },
        }),
      ),
    );

    return updated;
  }
}
