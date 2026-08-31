import type { $Enums } from "../../generated/prisma/client";
import { DriverDocumentRepository } from "../../repositories/driver/driverDocument.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../helper/errors";
import { advanceStep, DOCUMENT_LABELS, REQUIRED_DOCUMENTS } from "../../utils/onboardingSteps";
import { CloudinaryService } from "../shared/cloudinary.service";
import { ActivityService } from "../shared/activity.service";

export class DriverDocumentService {
  private documentRepo = new DriverDocumentRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private cloudinaryService = new CloudinaryService();
  private activityService = new ActivityService();

  async list(userId: string) {
    const documents = await this.documentRepo.findByUser(userId);
    const uploaded = new Set(documents.map(document => document.type));

    return {
      documents,
      // The screen renders a row per required document whether or not it has
      // been uploaded, so it needs the gaps as well as what is there.
      missing: REQUIRED_DOCUMENTS.filter(type => !uploaded.has(type)).map(type => ({ type, label: DOCUMENT_LABELS[type] })),
    };
  }

  async upload(userId: string, type: $Enums.DocumentType, file: Express.Multer.File) {
    const profile = await this.requireProfile(userId);

    if (profile.verification_status === "APPROVED") throw new ForbiddenError("Your documents are already verified. Contact support to change them.");

    const existing = await this.documentRepo.findByUserAndType(userId, type);

    const upload = await this.cloudinaryService.uploadFile(userId, "driver", file, "documents");

    const document = await this.documentRepo.upsert(userId, type, {
      url: upload.secure_url,
      public_id: upload.public_id,
      file_name: file.originalname,
      mime_type: file.mimetype,
      size_bytes: file.size,
    });

    // The replaced file is only removed once the row points at the new one, so
    // a failed upload never leaves the driver with no document at all.
    if (existing?.public_id) {
      await this.cloudinaryService.deleteFile(existing.public_id, existing.mime_type === "application/pdf" ? "raw" : "image").catch(() => undefined);
    }

    await this.activityService.record(userId, "DOCUMENT_UPLOADED", `${DOCUMENT_LABELS[type]} uploaded`);

    await this.maybeAdvanceStep(userId, profile.onboarding_step);

    return document;
  }

  async remove(userId: string, id: string) {
    const document = await this.documentRepo.findById(id);

    if (!document) throw new NotFoundError("That document was not found");
    if (document.userId !== userId) throw new ForbiddenError("That document belongs to another driver");
    if (document.status === "APPROVED") throw new ForbiddenError("An approved document cannot be removed");

    await this.documentRepo.delete(id);

    if (document.public_id) {
      await this.cloudinaryService.deleteFile(document.public_id, document.mime_type === "application/pdf" ? "raw" : "image").catch(() => undefined);
    }

    return { id };
  }

  async assertRequiredDocumentsPresent(userId: string) {
    const documents = await this.documentRepo.findByUser(userId);
    const uploaded = new Set(documents.map(document => document.type));

    const missing = REQUIRED_DOCUMENTS.filter(type => !uploaded.has(type));

    if (missing.length) {
      throw new BadRequestError(`Upload your ${missing.map(type => DOCUMENT_LABELS[type]).join(", ")} before submitting`);
    }
  }

  private async maybeAdvanceStep(userId: string, currentStep: $Enums.OnboardingStep) {
    const documents = await this.documentRepo.findByUser(userId);
    const uploaded = new Set(documents.map(document => document.type));

    if (REQUIRED_DOCUMENTS.every(type => uploaded.has(type))) {
      await this.driverProfileRepo.update(userId, { onboarding_step: advanceStep(currentStep, "DOCUMENTS") });
    }
  }

  private async requireProfile(userId: string) {
    const profile = (await this.driverProfileRepo.findByUserId(userId, { id: true, onboarding_step: true, verification_status: true })) as
      | { id: string; onboarding_step: $Enums.OnboardingStep; verification_status: $Enums.DriverVerificationStatus }
      | null;

    if (!profile) throw new NotFoundError("Driver profile not found");

    return profile;
  }
}
