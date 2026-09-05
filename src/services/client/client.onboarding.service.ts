import { ClientProfileRepository } from "../../repositories/user/clientProfile.repository";
import { cleanObject } from "../../utils/cleanedObject";
import { ClientPreferencesInput } from "../../utils/types/clientValidatorSchema";

export class ClientOnboardingService {
  private clientProfileRepo = new ClientProfileRepository();

  async getPreferences(userId: string) {
    return this.clientProfileRepo.ensureForUser(userId);
  }

  // Partial on purpose — each wizard step saves its own slice, so stopping
  // half-way loses nothing.
  async savePreferences(userId: string, data: ClientPreferencesInput) {
    await this.clientProfileRepo.ensureForUser(userId);

    return this.clientProfileRepo.update(userId, cleanObject(data));
  }

  // Skipping stamps completion too — the wizard is a prompt, not a gate, and it
  // must not reappear on every sign-in. Idempotent so a re-submit changes nothing.
  async complete(userId: string) {
    const profile = await this.clientProfileRepo.ensureForUser(userId);

    if (profile.onboarding_completed_at) return profile;

    return this.clientProfileRepo.update(userId, { onboarding_completed_at: new Date() });
  }
}
