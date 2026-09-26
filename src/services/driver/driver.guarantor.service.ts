import type { $Enums } from "../../generated/prisma/client";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { GuarantorRepository } from "../../repositories/driver/guarantor.repository";
import { ForbiddenError, NotFoundError } from "../../helper/errors";
import { advanceStep } from "../../utils/onboardingSteps";
import { CloudinaryService } from "../shared/cloudinary.service";
import type { GuarantorInput } from "../../utils/types/driverValidatorSchema";

export class DriverGuarantorService {
  private guarantorRepo = new GuarantorRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private cloudinaryService = new CloudinaryService();

  async list(userId: string) {
    const profile = await this.requireProfile(userId);

    const [guarantors, reference] = await Promise.all([this.guarantorRepo.findByDriver(profile.id), this.guarantorRepo.findReferenceByDriver(profile.id)]);

    return { guarantors, reference };
  }

  async save(userId: string, data: GuarantorInput) {
    const profile = await this.requireProfile(userId);

    await Promise.all([this.guarantorRepo.replaceForDriver(profile.id, data.guarantors), this.guarantorRepo.upsertReferenceForDriver(profile.id, data.reference)]);

    await this.driverProfileRepo.update(userId, { onboarding_step: advanceStep(profile.onboarding_step, "GUARANTORS") });

    const [guarantors, reference] = await Promise.all([this.guarantorRepo.findByDriver(profile.id), this.guarantorRepo.findReferenceByDriver(profile.id)]);

    return { guarantors, reference };
  }

  // The guarantor files are uploaded per guarantor rather than through the
  // document queue: they belong to the guarantor row, not to the driver, and
  // they are not part of what a reviewer approves or rejects individually.
  async uploadFile(userId: string, guarantorId: string, field: "passport_url" | "nin_slip_url", file: Express.Multer.File) {
    const profile = await this.requireProfile(userId);
    const guarantor = await this.guarantorRepo.findById(guarantorId);

    if (!guarantor) throw new NotFoundError("That guarantor was not found");
    if (guarantor.driverId !== profile.id) throw new ForbiddenError("That guarantor belongs to another driver");

    const upload = await this.cloudinaryService.uploadFile(userId, "driver", file, "guarantors");

    return this.guarantorRepo.update(guarantorId, { [field]: upload.secure_url });
  }

  async remove(userId: string, guarantorId: string) {
    const profile = await this.requireProfile(userId);
    const guarantor = await this.guarantorRepo.findById(guarantorId);

    if (!guarantor) throw new NotFoundError("That guarantor was not found");
    if (guarantor.driverId !== profile.id) throw new ForbiddenError("That guarantor belongs to another driver");

    const remaining = await this.guarantorRepo.countForDriver(profile.id);

    if (remaining <= 1) throw new ForbiddenError("You need at least one guarantor on your profile");

    return this.guarantorRepo.delete(guarantorId);
  }

  private async requireProfile(userId: string) {
    const profile = (await this.driverProfileRepo.findByUserId(userId, { id: true, onboarding_step: true })) as { id: string; onboarding_step: $Enums.OnboardingStep } | null;

    if (!profile) throw new NotFoundError("Driver profile not found");

    return profile;
  }
}
