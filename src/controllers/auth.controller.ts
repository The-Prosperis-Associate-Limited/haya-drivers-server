import { Request, Response } from "express";
import { handleErrors } from "../helper/handleErrors";
import { IUserRequest } from "../interface";
import {
  forgotPasswordSchema,
  googleNativeSignInSchema,
  loginValidationSchema,
  registerValidationSchema,
  resetPasswordSchema,
  sendEmailOtpSchema,
  sendPasswordResetOtpSchema,
  updatePasswordSchema,
  updateProfileSchema,
  verifyEmailOtpSchema,
  verifyPasswordResetOtpSchema,
} from "../utils/types/authValidatorSchema";
import { AuthRegistrationService } from "../services/auth/auth.registration.service";
import { AuthSessionService } from "../services/auth/auth.session.service";
import { AuthPasswordService } from "../services/auth/auth.password.service";
import { AuthOAuthService } from "../services/auth/auth.oauth.service";
import { ProfileService } from "../services/auth/profile.service";

export class AuthController {
  private registrationService = new AuthRegistrationService();
  private sessionService = new AuthSessionService();
  private passwordService = new AuthPasswordService();
  private oauthService = new AuthOAuthService();
  private profileService = new ProfileService();

  testApi = async (_req: Request, res: Response) => {
    res.status(200).json({ message: "SERVERS ARE LIVE!!!" });
  };

  createUser = async (req: IUserRequest, res: Response) => {
    try {
      const data = registerValidationSchema.parse(req.body);

      await this.registrationService.register(data);

      res.status(201).json({ message: "Account created successfully. Check your email to verify it." });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  loginUser = async (req: IUserRequest, res: Response) => {
    try {
      const { email, password } = loginValidationSchema.parse(req.body);

      const { user, tokens } = await this.sessionService.login(email, password);

      res.status(200).json({ message: "Login Successful", data: { user, token: tokens } });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  generateNewToken = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.sessionService.refresh(req.userId as string, req.role as string);

      res.status(200).json({ message: "Token refreshed", token: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  reactivateAccount = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.sessionService.reactivate(req.userId as string);

      res.status(200).json({ message: "Welcome back! Your account is active again.", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  validateEmail = async (req: Request, res: Response) => {
    try {
      const { token } = req.query;

      if (!token) return res.status(400).json({ message: "Invalid token or token not provided" });

      const redirectUrl = await this.sessionService.validateEmailByToken(token as string);

      res.redirect(redirectUrl);
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  sendEmailOtp = async (req: Request, res: Response) => {
    try {
      const { email } = sendEmailOtpSchema.parse(req.body);

      await this.sessionService.sendEmailVerificationOtp(email);

      // Always the same response, whether or not that address has an account -
      // the service deliberately does not distinguish the two.
      res.status(200).json({ message: "If that email needs verifying, a code is on its way." });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  verifyEmailOtp = async (req: Request, res: Response) => {
    try {
      const { email, code } = verifyEmailOtpSchema.parse(req.body);

      const { user, tokens } = await this.sessionService.verifyEmailOtp(email, code);

      res.status(200).json({ message: "Email verified successfully", data: { user, token: tokens } });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  forgotPassword = async (req: Request, res: Response) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);

      await this.passwordService.forgotPassword(email);

      res.status(200).json({ message: "If that account exists, a reset link is on its way." });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  sendPasswordResetOtp = async (req: Request, res: Response) => {
    try {
      const { email } = sendPasswordResetOtpSchema.parse(req.body);

      await this.passwordService.sendPasswordResetOtp(email);

      res.status(200).json({ message: "If that account exists, a reset code is on its way." });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  verifyPasswordResetOtp = async (req: Request, res: Response) => {
    try {
      const { email, code } = verifyPasswordResetOtpSchema.parse(req.body);

      const data = await this.passwordService.verifyPasswordResetOtp(email, code);

      res.status(200).json({ message: "Code verified", data });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  resetPassword = async (req: Request, res: Response) => {
    try {
      const { token } = req.query;
      const { password } = resetPasswordSchema.parse(req.body);

      if (!token) return res.status(400).json({ message: "Reset token is required" });

      await this.passwordService.resetPassword(token as string, password);

      res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  updatePassword = async (req: IUserRequest, res: Response) => {
    try {
      const { current_password, new_password } = updatePasswordSchema.parse(req.body);

      await this.passwordService.updatePassword(req.userId as string, current_password, new_password);

      res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  googleNativeSignIn = async (req: Request, res: Response) => {
    try {
      const { idToken, role } = googleNativeSignInSchema.parse(req.body);

      const { user, tokens } = await this.oauthService.nativeSignIn(idToken, role);

      res.status(200).json({ message: "Login Successful", data: { user, token: tokens } });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  validateOAuthSession = async (req: IUserRequest, res: Response) => {
    try {
      const { user, tokens } = await this.oauthService.validateOAuthSession(req.userId as string);

      res.status(200).json({ message: "Login Successful", data: { user, token: tokens } });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  getProfile = async (req: IUserRequest, res: Response) => {
    try {
      const result = await this.profileService.getProfile(req.userId as string);

      res.status(200).json({ message: "Profile fetched successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  updateProfile = async (req: IUserRequest, res: Response) => {
    try {
      const data = updateProfileSchema.parse(req.body);

      const result = await this.profileService.updateProfile(req.userId as string, req.role as string, data, req.file);

      res.status(200).json({ message: "Profile updated successfully", data: result });
    } catch (error) {
      handleErrors({ res, error });
    }
  };

  deactivateAccount = async (req: IUserRequest, res: Response) => {
    try {
      await this.profileService.deactivateAccount(req.userId as string);

      res.status(200).json({ message: "Account deactivated" });
    } catch (error) {
      handleErrors({ res, error });
    }
  };
}
