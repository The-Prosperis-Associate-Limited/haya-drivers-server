import type { $Enums } from "../../generated/prisma/client";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { NotFoundError } from "../../helper/errors";
import { advanceStep } from "../../utils/onboardingSteps";
import type { AcademicQualificationInput, AdditionalInformationInput, ExperienceInput, PersonalInformationInput } from "../../utils/types/driverValidatorSchema";

export class DriverProfileService {
  private driverProfileRepo = new DriverProfileRepository();
  private userRepo = new UserRepository();

  async get(userId: string) {
    const profile = await this.driverProfileRepo.findByUserIdWithRelations(userId);

    if (!profile) throw new NotFoundError("Driver profile not found");

    return profile;
  }

  // Personal information straddles both tables: the parts every account has
  // live on User, the driver-only part on DriverProfile.
  async savePersonalInformation(userId: string, data: PersonalInformationInput) {
    const { state_of_origin, ...userFields } = data;

    const current = await this.requireProfile(userId);

    await Promise.all([
      this.userRepo.updateUser(userId, userFields),
      this.driverProfileRepo.update(userId, {
        state_of_origin,
        onboarding_step: advanceStep(current.onboarding_step, "PERSONAL_INFORMATION"),
      }),
    ]);

    return this.get(userId);
  }

  async saveExperience(userId: string, data: ExperienceInput) {
    const current = await this.requireProfile(userId);

    await this.driverProfileRepo.update(userId, {
      ...data,
      onboarding_step: advanceStep(current.onboarding_step, "EXPERIENCE"),
    });

    return this.get(userId);
  }

  async saveAcademicQualification(userId: string, data: AcademicQualificationInput) {
    const current = await this.requireProfile(userId);

    await this.driverProfileRepo.update(userId, {
      ...data,
      onboarding_step: advanceStep(current.onboarding_step, "ACADEMIC_QUALIFICATION"),
    });

    return this.get(userId);
  }

  async saveAdditionalInformation(userId: string, data: AdditionalInformationInput) {
    const current = await this.requireProfile(userId);

    await this.driverProfileRepo.update(userId, {
      ...data,
      onboarding_step: advanceStep(current.onboarding_step, "ADDITIONAL_INFORMATION"),
    });

    return this.get(userId);
  }

  private async requireProfile(userId: string) {
    const profile = (await this.driverProfileRepo.findByUserId(userId, { id: true, onboarding_step: true })) as { id: string; onboarding_step: $Enums.OnboardingStep } | null;

    if (!profile) throw new NotFoundError("Driver profile not found");

    return profile;
  }
}
