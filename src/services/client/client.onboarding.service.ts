import { ClientProfileRepository } from "../../repositories/user/clientProfile.repository";
import { UserRepository } from "../../repositories/user/user.repository";
import { cleanObject } from "../../utils/cleanedObject";
import { ClientPreferencesInput } from "../../utils/types/clientValidatorSchema";

export class ClientOnboardingService {
  private clientProfileRepo = new ClientProfileRepository();
  private userRepo = new UserRepository();

  // The phone lives on User, not the profile; it rides along so the wizard can prefill it.
  async getPreferences(userId: string) {
    const [profile, user] = await Promise.all([this.clientProfileRepo.ensureForUser(userId), this.userRepo.findById(userId, { phone_no: true })]);

    return { ...profile, phone_no: user?.phone_no ?? null };
  }

  // Partial on purpose - each wizard step saves its own slice, so stopping
  // half-way loses nothing.
  async savePreferences(userId: string, data: ClientPreferencesInput) {
    const { phone_no, ...preferences } = data;

    await this.clientProfileRepo.ensureForUser(userId);

    await Promise.all([this.clientProfileRepo.update(userId, cleanObject(preferences)), phone_no ? this.userRepo.updateUser(userId, { phone_no }) : null]);

    return this.getPreferences(userId);
  }

  // Skipping stamps completion too - the wizard is a prompt, not a gate, and it
  // must not reappear on every sign-in. Idempotent so a re-submit changes nothing.
  async complete(userId: string) {
    const profile = await this.clientProfileRepo.ensureForUser(userId);

    if (profile.onboarding_completed_at) return profile;

    return this.clientProfileRepo.update(userId, { onboarding_completed_at: new Date() });
  }
}
