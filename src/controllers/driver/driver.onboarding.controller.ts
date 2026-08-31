import { Response } from "express";
import { handleErrors } from "../../helper/handleErrors";
import { IUserRequest } from "../../interface";
import { DriverProfileService } from "../../services/driver/driver.profile.service";
import { DriverWorkExperienceService } from "../../services/driver/driver.workExperience.service";
import { DriverGuarantorService } from "../../services/driver/driver.guarantor.service";
import { DriverVerificationService } from "../../services/driver/driver.verification.service";
import {
  academicQualificationSchema,
  additionalInformationSchema,
  experienceSchema,
  guarantorSchema,
  personalInformationSchema,
  workExperienceSchema,
} from "../../utils/types/driverValidatorSchema";

export class DriverOnboardingController {
  private profileService = new DriverProfileService();
  private workExperienceService = new DriverWorkExperienceService();
  private guarantorService = new DriverGuarantorService();
  private verificationService = new DriverVerificationService();

  getProfile = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.profileService.get(req.userId as string);

      res.status(200).json({ message: "Profile fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  savePersonalInformation = async (req: IUserRequest, res: Response) => {
    try {
      const data = personalInformationSchema.parse(req.body);

      const result = await this.profileService.savePersonalInformation(req.userId as string, data);

      res.status(200).json({ message: "Personal information saved", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  saveExperience = async (req: IUserRequest, res: Response) => {
    try {
      const data = experienceSchema.parse(req.body);

      const result = await this.profileService.saveExperience(req.userId as string, data);

      res.status(200).json({ message: "Experience saved", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  saveAcademicQualification = async (req: IUserRequest, res: Response) => {
    try {
      const data = academicQualificationSchema.parse(req.body);

      const result = await this.profileService.saveAcademicQualification(req.userId as string, data);

      res.status(200).json({ message: "Academic qualification saved", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  saveWorkExperience = async (req: IUserRequest, res: Response) => {
    try {
      const data = workExperienceSchema.parse(req.body);

      const result = await this.workExperienceService.save(req.userId as string, data);

      res.status(200).json({ message: "Work experience saved", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  deleteWorkExperience = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.workExperienceService.remove(req.userId as string, req.params.id);

      res.status(200).json({ message: "Role removed", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  saveGuarantors = async (req: IUserRequest, res: Response) => {
    try {
      const data = guarantorSchema.parse(req.body);

      const result = await this.guarantorService.save(req.userId as string, data);

      res.status(200).json({ message: "Guarantors saved", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  uploadGuarantorFile = async (req: IUserRequest, res: Response) => {
    try {
      const field = req.params.field === "nin-slip" ? "nin_slip_url" : "passport_url";

      if (!req.file) return res.status(400).json({ message: "No file was uploaded" });

      const result = await this.guarantorService.uploadFile(req.userId as string, req.params.id, field, req.file);

      res.status(200).json({ message: "File uploaded", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  deleteGuarantor = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.guarantorService.remove(req.userId as string, req.params.id);

      res.status(200).json({ message: "Guarantor removed", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  saveAdditionalInformation = async (req: IUserRequest, res: Response) => {
    try {
      const data = additionalInformationSchema.parse(req.body);

      const result = await this.profileService.saveAdditionalInformation(req.userId as string, data);

      res.status(200).json({ message: "Additional information saved", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  submit = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.verificationService.submit(req.userId as string);

      res.status(200).json({ message: "Documents submitted for verification", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  verificationStatus = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.verificationService.getStatus(req.userId as string);

      res.status(200).json({ message: "Verification status fetched", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
