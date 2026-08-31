import "dotenv/config";
const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, GOOGLE_VERIFICATION_TOKEN, EMAIL_VERIFICATION_TOKEN } = process.env;
import jwt, { Secret } from "jsonwebtoken";

type Payload = {
  id: string;
  role: string;
};

export const generateAccessToken = (dataObj: Payload) => {
  return jwt.sign(dataObj, ACCESS_TOKEN_SECRET as Secret, { expiresIn: "30m" });
};

export const generateRefreshToken = (dataObj: Payload) => {
  return jwt.sign(dataObj, REFRESH_TOKEN_SECRET as Secret, { expiresIn: "7d" });
};

export const generateGoogleVerificationToken = (dataObj: Payload) => {
  return jwt.sign(dataObj, GOOGLE_VERIFICATION_TOKEN as Secret, { expiresIn: "2m" });
};

export const generateEmailVerificationToken = (id: string) => {
  return jwt.sign({ id }, EMAIL_VERIFICATION_TOKEN as Secret);
};

export const generatePasswordResetToken = (id: string) => {
  return jwt.sign({ id }, EMAIL_VERIFICATION_TOKEN as Secret, { expiresIn: "10m" });
};

export const generateTokenPair = (dataObj: Payload) => ({
  accessToken: generateAccessToken(dataObj),
  refreshToken: generateRefreshToken(dataObj),
});
