import { HireRequestRepository } from "../../repositories/booking/hireRequest.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { NotificationService } from "../shared/notification.service";

const hireRepo = new HireRequestRepository();
const userRepo = new UserRepository();
const notificationService = new NotificationService();

export const expireShortlists = async () => {
  const now = new Date();
  const overdue = await hireRepo.findOverdueAssignments(now);

  if (!overdue.length) return "No shortlist invitations to expire";

  await hireRepo.expireAssignments(
    overdue.map(assignment => assignment.id),
    now,
  );

  const byRequest = new Map<string, number>();
  for (const assignment of overdue) byRequest.set(assignment.hire_request.reference, (byRequest.get(assignment.hire_request.reference) ?? 0) + 1);

  const adminIds = await userRepo.findAdminIds();

  await Promise.all([
    ...overdue.map(assignment =>
      notificationService.notify({
        recipientId: assignment.driverId,
        type: "WARNING",
        title: "A shortlist invitation expired",
        message: `You didn't reply in time for ${assignment.hire_request.reference}, so the team has moved on. Quick replies keep you at the top of shortlists.`,
        actionUrl: "/dashboard",
      }),
    ),
    ...[...byRequest].flatMap(([reference, count]) =>
      adminIds.map(recipientId =>
        notificationService.notify({
          recipientId,
          type: "BOOKING_STATUS",
          title: "Shortlist replies expired",
          message: `${count} shortlisted driver(s) on ${reference} didn't reply in time and were marked not available.`,
          actionUrl: "/dashboard/hires",
          metadata: { reference },
        }),
      ),
    ),
  ]);

  return `${overdue.length} shortlist invitation(s) expired`;
};
