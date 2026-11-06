import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { RequiredDocumentsService } from "../driver/driver.requiredDocuments.service";

const driverProfileRepo = new DriverProfileRepository();
const requiredDocumentsService = new RequiredDocumentsService();

export const enforceRequiredDocuments = async () => {
  const overdue = await driverProfileRepo.findDocumentsOverdue(new Date());
  const outcomes = { unverified: 0, extended: 0, waiting: 0 };

  for (const driver of overdue) {
    const outcome = await requiredDocumentsService.enforceDeadline(driver);
    outcomes[outcome] += 1;
  }

  return `${outcomes.unverified} driver(s) unverified for missing documents, ${outcomes.extended} extended for active jobs, ${outcomes.waiting} waiting on review`;
};
