import { NextFunction, Response } from "express";
import { IUserRequest } from "../interface";
import { handleErrors } from "../helper/handleErrors";
import { DriverProfileRepository } from "../repositories/driver/driverProfile.repository";

const driverProfileRepository = new DriverProfileRepository();

/*
  Withholds the surfaces that put a driver in front of paying clients until a
  human has cleared their documents. It can only ever withhold, never grant —
  an unverified driver keeps full access to onboarding, training and support.
*/
export const requireVerifiedDriver = async function (req: IUserRequest, res: Response, next: NextFunction) {
  try {
    if (req.role === "ADMIN") return next();

    const profile = await driverProfileRepository.findByUserId(req.userId as string, { verification_status: true });

    if (!profile) return res.status(404).json({ message: "Driver profile not found" });

    if (profile.verification_status !== "APPROVED") {
      return res.status(403).json({
        message: "Your documents are still being reviewed. This becomes available once you're verified.",
        verificationStatus: profile.verification_status,
      });
    }

    next();
  } catch (error) {
    handleErrors({ res, error });
  }
};
