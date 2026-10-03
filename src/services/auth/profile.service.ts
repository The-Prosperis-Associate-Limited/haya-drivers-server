import { UserRepository } from "../../repositories/user/user.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { NotFoundError } from "../../helper/errors";
import { cleanObject } from "../../utils/cleanedObject";
import { CloudinaryService } from "../shared/cloudinary.service";
import { UpdateProfileInput } from "../../utils/types/authValidatorSchema";
import { ActivityService } from "../shared/activity.service";

export class ProfileService {
  private userRepo = new UserRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private cloudinaryService = new CloudinaryService();
  private activityService = new ActivityService();

  async getProfile(userId: string) {
    const user = await this.userRepo.findById(userId, {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      phone_no: true,
      whatsapp_number: true,
      profile_pic: true,
      bio: true,
      role: true,
      gender: true,
      date_of_birth: true,
      marital_status: true,
      country: true,
      state_of_residence: true,
      city: true,
      address: true,
      timezone: true,
      has_validated_email: true,
      account_status: true,
      deactivated_for_inactivity: true,
      createdAt: true,
      driver_profile: true,
      client_profile: true,
      admin_profile: true,
    });

    if (!user) throw new NotFoundError("Account not found");

    return user;
  }

  async updateProfile(userId: string, role: string, data: UpdateProfileInput, file?: Express.Multer.File) {
    const payload: Record<string, unknown> = cleanObject(data);

    if (file) {
      const upload = await this.cloudinaryService.uploadFile(userId, role, file, "avatar");
      payload.profile_pic = upload.secure_url;
    }

    const user = await this.userRepo.updateUser(userId, payload);

    await this.activityService.record(userId, "PROFILE_UPDATED", "Profile updated");

    const { password: _, ...safeUser } = user;

    return safeUser;
  }

  async deactivateAccount(userId: string) {
    await this.userRepo.updateUser(userId, { account_status: "DEACTIVATED", sessions_valid_from: new Date() });

    // A deactivated driver drops out of client search immediately rather than
    // waiting for the next trust-score sweep.
    const profile = await this.driverProfileRepo.findByUserId(userId, { id: true });

    if (profile) await this.driverProfileRepo.update(userId, { is_discoverable: false });
  }
}
