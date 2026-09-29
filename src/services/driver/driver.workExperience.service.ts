import type { $Enums } from "../../generated/prisma/client";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { WorkExperienceRepository } from "../../repositories/driver/workExperience.repository";
import { ForbiddenError, NotFoundError } from "../../helper/errors";
import { advanceStep } from "../../utils/onboardingSteps";
import type { WorkExperienceInput } from "../../utils/types/driverValidatorSchema";

export class DriverWorkExperienceService {
  private workExperienceRepo = new WorkExperienceRepository();
  private driverProfileRepo = new DriverProfileRepository();

  async list(userId: string) {
    const profile = await this.requireProfile(userId);

    return this.workExperienceRepo.findByDriver(profile.id);
  }

  // The step submits the whole list, so it replaces rather than merges - a role
  // the driver removed on screen has to disappear here too.
  async save(userId: string, data: WorkExperienceInput) {
    const profile = await this.requireProfile(userId);

    await this.workExperienceRepo.replaceForDriver(
      profile.id,
      data.experiences.map(entry => ({ ...entry, ended_at: entry.is_current ? null : (entry.ended_at ?? null) })),
    );

    await this.driverProfileRepo.update(userId, { onboarding_step: advanceStep(profile.onboarding_step, "WORK_EXPERIENCE") });

    return this.workExperienceRepo.findByDriver(profile.id);
  }

  async remove(userId: string, id: string) {
    const profile = await this.requireProfile(userId);
    const entry = await this.workExperienceRepo.findById(id);

    if (!entry) throw new NotFoundError("That role was not found");
    if (entry.driverId !== profile.id) throw new ForbiddenError("That role belongs to another driver");

    return this.workExperienceRepo.delete(id);
  }

  private async requireProfile(userId: string) {
    const profile = (await this.driverProfileRepo.findByUserId(userId, { id: true, onboarding_step: true })) as { id: string; onboarding_step: $Enums.OnboardingStep } | null;

    if (!profile) throw new NotFoundError("Driver profile not found");

    return profile;
  }
}
