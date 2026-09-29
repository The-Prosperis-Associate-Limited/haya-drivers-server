import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { AuthOAuthService, type OAuthRole } from "../services/auth/auth.oauth.service";
import { AppError } from "../helper/errors";

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = process.env;

/*
  An adapter only: it unpacks the Google profile and hands it to
  AuthOAuthService.resolveGoogleUser, which is the same code the native mobile
  endpoint runs.
*/
export const passportSetup = function () {
  // The strategy constructor throws without a client id, which would take the
  // whole server down on any environment where Google sign-in is not set up
  // yet. Skipping registration leaves only the /auth/google/* routes broken.
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn("⚠️  Google OAuth is not configured - /auth/google/* is unavailable.");
    return;
  }

  const oauthService = new AuthOAuthService();

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        passReqToCallback: true,
      },
      async function (req, _accessToken, _refreshToken, profile, done) {
        try {
          const { id, name, emails, _json } = profile;

          const role = (req.query.state as OAuthRole) ?? "driver";

          const user = await oauthService.resolveGoogleUser(
            {
              googleId: id,
              email: emails?.[0]?.value ?? "",
              emailVerified: !!_json.email_verified,
              firstName: name?.givenName,
              lastName: name?.familyName,
              picture: _json.picture,
            },
            role,
          );

          done(null, user as any);
        } catch (error) {
          // A rejection the user can act on (suspended account, unverified
          // Google email, disposable domain) is a failed login with a message,
          // not a 500.
          if (error instanceof AppError) return done(null, false, { message: error.message });

          done(error as Error, undefined);
        }
      },
    ),
  );
};
