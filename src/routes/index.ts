import { Application, Request, Response } from "express";
import { adminRouter } from "./admin";
import { analyticsRouter } from "./analyticsRoutes";
import { authRouter } from "./authRoutes";
import { chatRouter } from "./chatRoutes";
import { clientRouter } from "./client";
import { createDocsRouter } from "./docsRoutes";
import { driverRouter } from "./driver";
import { notificationRouter } from "./notificationRoutes";
import { pushRouter } from "./pushRoutes";
import { ticketRouter } from "./ticketRoutes";
import { webhookRouter } from "./webhookRoutes";

export const registerRoutes = (app: Application) => {
  app.get("/api", (_req: Request, res: Response) => res.status(200).json({ message: "SERVERS ARE LIVE!!!" }));

  app.use("/api/auth", authRouter);
  app.use("/api/driver", driverRouter);
  app.use("/api/client", clientRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/push", pushRouter);
  app.use("/api/tickets", ticketRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/webhooks", webhookRouter);
  app.use("/api/docs", createDocsRouter(app));

  app.use("*", (_req: Request, res: Response) => {
    res.status(404).json({
      error: "Not Found",
      message: "The requested endpoint does not exist!",
      explorableSolutions: {
        solution1: 'ensure the "METHOD" used to call the endpoint is correct!',
        solution2: "ensure the relative paths to the server url is defined correctly",
      },
    });
  });
};
