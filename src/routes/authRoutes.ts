import { Router } from "express";
import passport from "passport";
import { AuthController } from "../controllers/auth.controller";
import { generateGoogleVerificationToken } from "../helper/generateToken";
import { IUserRequest } from "../interface";
import { validateAccessToken, validateGoogleVerificationToken, validateRefreshToken } from "../middleware/validateToken";
import { credentialLimiter, emailSendLimiter } from "../middleware/rateLimit";
import { surfaceUrlFor } from "../utils/surfaceUrl";
import { upload } from "../utils/multerConfig";

const authRouter = Router();
const authController = new AuthController();

authRouter.get("/", authController.testApi);

authRouter.get("/google/driver", passport.authenticate("google", { scope: ["profile", "email"], state: "driver" }));
authRouter.get("/google/client", passport.authenticate("google", { scope: ["profile", "email"], state: "client" }));

authRouter.get("/google/callback", passport.authenticate("google", { session: false }), async (req: IUserRequest, res) => {
  const user = req.user as { id: string; role: string } | undefined;

  if (!user) return res.redirect(`${process.env.CLIENT_URL}/auth/signin?error=authentication_failed`);

  const google_token = generateGoogleVerificationToken({ id: user.id, role: user.role });

  res.redirect(`${surfaceUrlFor(user.role)}/auth/signin?token=${google_token}`);
});

authRouter.get("/google/callback/validate-session/:tokenId", validateGoogleVerificationToken, authController.validateOAuthSession);
authRouter.post("/google/native", credentialLimiter, authController.googleNativeSignIn);

authRouter.post("/create-user", credentialLimiter, authController.createUser);
authRouter.post("/login", credentialLimiter, authController.loginUser);
authRouter.post("/token", validateRefreshToken, authController.generateNewToken);

authRouter.get("/verify-email", authController.validateEmail);
authRouter.post("/send-email-otp", emailSendLimiter, authController.sendEmailOtp);
authRouter.post("/verify-email-otp", credentialLimiter, authController.verifyEmailOtp);

authRouter.post("/forgot-password", emailSendLimiter, authController.forgotPassword);
authRouter.post("/send-password-reset-otp", emailSendLimiter, authController.sendPasswordResetOtp);
authRouter.post("/verify-password-reset-otp", credentialLimiter, authController.verifyPasswordResetOtp);
authRouter.post("/reset-password", credentialLimiter, authController.resetPassword);
authRouter.put("/update-password", validateAccessToken, authController.updatePassword);

authRouter.get("/get-profile", validateAccessToken, authController.getProfile);
authRouter.put("/update-profile", validateAccessToken, upload.single("profile_pic"), authController.updateProfile);
authRouter.delete("/deactivate", validateAccessToken, authController.deactivateAccount);

export { authRouter };
