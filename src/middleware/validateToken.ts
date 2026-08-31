import { NextFunction, Response } from "express";
const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, GOOGLE_VERIFICATION_TOKEN } = process.env;
import jwt, { Secret } from "jsonwebtoken";
import { CustomJwtPayload, IUserRequest } from "../interface";
import { handleErrors } from "../helper/handleErrors";
import { UserRepository } from "../repositories/user/user.repository";

const userRepository = new UserRepository();

const validateAccessToken = async function (req: IUserRequest, res: Response, next: NextFunction) {
  let token = req.headers["authorization"]?.split(" ")[1];

  if (!token && req.cookies) {
    token = req.cookies["session_id"];
  }

  if (!token) return res.status(401).json({ message: "Access Denied, No token provided!" });

  try {
    const { id, role, iat } = jwt.verify(token, ACCESS_TOKEN_SECRET as Secret) as CustomJwtPayload;

    // A password reset stamps `sessions_valid_from`; anything minted before it
    // is refused so "signed out on all other devices" is true, not just copy.
    const user = await userRepository.findById(id, { account_status: true, sessions_valid_from: true });

    if (!user) return res.status(401).json({ message: "Account no longer exists" });
    if (user.account_status !== "ACTIVE") return res.status(403).json({ message: "This account is not active. Please contact support." });
    if (user.sessions_valid_from && iat && iat * 1000 < user.sessions_valid_from.getTime()) {
      return res.status(401).json({ message: "This session has expired, please sign in again" });
    }

    req.userId = id;
    req.role = role;
    next();
  } catch (error) {
    handleErrors({ res, error });
  }
};

const validateRefreshToken = function (req: IUserRequest, res: Response, next: NextFunction) {
  try {
    let refreshToken = req.body.refreshToken;

    if (!refreshToken) {
      refreshToken = req.cookies?.["session_id_ref"];
    }

    if (!refreshToken) return res.status(401).json({ message: "Access Denied, Refresh token not provided!" });

    const { id, role } = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET as Secret) as CustomJwtPayload;

    req.userId = id;
    req.role = role;
    next();
  } catch (error) {
    handleErrors({ res, error });
  }
};

const validateGoogleVerificationToken = function (req: IUserRequest, res: Response, next: NextFunction) {
  try {
    const tokenId = req.params.tokenId as string;
    if (!tokenId) return res.status(400).json({ message: "Token ID is required" });

    const { id, role } = jwt.verify(tokenId, GOOGLE_VERIFICATION_TOKEN as Secret) as CustomJwtPayload;

    req.userId = id;
    req.role = role;
    next();
  } catch (error) {
    handleErrors({ res, error });
  }
};

const validateDriverSession = function (req: IUserRequest, res: Response, next: NextFunction) {
  if (req.role !== "DRIVER") return res.status(403).json({ message: "Unauthorized!, only a driver is authorized to do this" });
  next();
};

const validateClientSession = function (req: IUserRequest, res: Response, next: NextFunction) {
  if (req.role !== "CLIENT") return res.status(403).json({ message: "Unauthorized!, only a client is authorized to do this" });
  next();
};

const validateAdminSession = function (req: IUserRequest, res: Response, next: NextFunction) {
  if (req.role !== "ADMIN") return res.status(403).json({ message: "Unauthorized!, only an admin is authorized to do this" });
  next();
};

export { validateAccessToken, validateRefreshToken, validateGoogleVerificationToken, validateDriverSession, validateClientSession, validateAdminSession };
