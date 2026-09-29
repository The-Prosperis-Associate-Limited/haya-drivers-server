import { OAuth2Client } from "google-auth-library";
import type { $Enums } from "../../generated/prisma/client";
import { UserRepository } from "../../repositories/user/user.repository";
import { DriverProfileRepository } from "../../repositories/driver/driverProfile.repository";
import { ClientProfileRepository } from "../../repositories/user/clientProfile.repository";
import { WalletRepository } from "../../repositories/earnings/wallet.repository";
import { BadRequestError, ForbiddenError } from "../../helper/errors";
import { generateTokenPair } from "../../helper/generateToken";
import { isDisposableEmailDomain } from "../../utils/emailDomain";
import { ActivityService } from "../shared/activity.service";

const { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID } = process.env;

export type OAuthRole = "driver" | "client";

const ROLE_MAP: Record<OAuthRole, $Enums.UserRole> = {
  driver: "DRIVER",
  client: "CLIENT",
};

interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
  picture?: string;
}

/*
  One resolver for both Google paths - the browser redirect and the native
  sheet. A second copy would eventually lose one of the guards below, and the
  guards are the whole point.
*/
export class AuthOAuthService {
  private userRepo = new UserRepository();
  private driverProfileRepo = new DriverProfileRepository();
  private clientProfileRepo = new ClientProfileRepository();
  private walletRepo = new WalletRepository();
  private activityService = new ActivityService();

  async resolveGoogleUser(identity: GoogleIdentity, role: OAuthRole) {
    if (!identity.email) throw new BadRequestError("Google did not return an email address");
    if (!identity.emailVerified) throw new BadRequestError("Your Google email address is not verified");
    if (isDisposableEmailDomain(identity.email)) throw new BadRequestError("Temporary or disposable email addresses are not accepted.");

    const existing = await this.userRepo.findByEmail(identity.email);

    if (existing) {
      if (existing.account_status !== "ACTIVE") throw new ForbiddenError("This account is not active. Please contact support.");

      if (!existing.googleId) {
        await this.userRepo.updateUser(existing.id, { googleId: identity.googleId, has_validated_email: true });
      }

      return existing;
    }

    const user = await this.userRepo.createUser({
      email: identity.email,
      first_name: identity.firstName ?? null,
      last_name: identity.lastName ?? null,
      profile_pic: identity.picture ?? null,
      googleId: identity.googleId,
      role: ROLE_MAP[role],
      authProvider: "GOOGLE",
      // Google has already proven the mailbox; asking again would be theatre.
      has_validated_email: true,
      terms_accepted_at: new Date(),
    });

    if (user.role === "DRIVER") {
      await Promise.all([this.driverProfileRepo.create({ userId: user.id }), this.walletRepo.ensureForUser(user.id)]);
    }

    // Google tells us nothing about what they hire as - INDIVIDUAL until the
    // onboarding wizard says otherwise.
    if (user.role === "CLIENT") {
      await Promise.all([this.clientProfileRepo.ensureForUser(user.id), this.walletRepo.ensureForUser(user.id)]);
    }

    await this.activityService.record(user.id, "ACCOUNT_CREATED", "Account created with Google");

    return user;
  }

  /*
    Audience is the whole trust boundary. The native SDKs request a token
    audienced to the WEB client, not the platform one, so GOOGLE_WEB_CLIENT_ID
    is the variable that matters. With none of them set this refuses every
    token rather than accepting any.
  */
  async verifyNativeIdToken(idToken: string) {
    const audiences = [GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID].filter(Boolean) as string[];

    if (!audiences.length) throw new BadRequestError("Native Google sign-in is not configured");

    const client = new OAuth2Client();

    const ticket = await client.verifyIdToken({ idToken, audience: audiences });
    const payload = ticket.getPayload();

    if (!payload) throw new BadRequestError("That Google token is not valid");

    return {
      googleId: payload.sub,
      email: payload.email ?? "",
      emailVerified: !!payload.email_verified,
      firstName: payload.given_name,
      lastName: payload.family_name,
      picture: payload.picture,
    };
  }

  async nativeSignIn(idToken: string, role: OAuthRole) {
    const identity = await this.verifyNativeIdToken(idToken);
    const user = await this.resolveGoogleUser(identity, role);

    const { password: _, ...safeUser } = user;

    return { user: safeUser, tokens: generateTokenPair({ id: user.id, role: user.role }) };
  }

  async validateOAuthSession(userId: string) {
    const user = await this.userRepo.findById(userId);

    if (!user) throw new BadRequestError("Account not found");

    const { password: _, ...safeUser } = user;

    return { user: safeUser, tokens: generateTokenPair({ id: user.id, role: user.role }) };
  }
}
