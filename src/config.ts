import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application } from "express";
import helmet from "helmet";
import morgan from "morgan";
import passport from "passport";
import { passportSetup } from "./utils/passportSetup";

const { CLIENT_URL, ADMIN_URL, ALLOWED_ORIGINS } = process.env;

// Three surfaces plus local development. Extra origins come from the
// environment so a new regional domain does not need a deploy of this file.
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  CLIENT_URL,
  ADMIN_URL,
  ...(ALLOWED_ORIGINS?.split(",").map(origin => origin.trim()) ?? []),
].filter(Boolean) as string[];

export const configureApp = (app: Application) => {
  app.use(morgan("dev"));
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(
    express.json({
      limit: "10mb",
      // Paystack signs the raw body, so it has to survive the parser.
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody: string }).rawBody = buf.toString("utf8");
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "10mb" }));
  app.use(cookieParser());
  app.use(helmet());
  app.use(passport.initialize());
  passportSetup();
};
