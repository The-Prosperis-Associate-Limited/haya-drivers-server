import "dotenv/config";

import express from "express";
import { configureApp } from "./config";
import { initializeSocket } from "./helper/socket";
import { registerRoutes } from "./routes/index";
import { seedProdAdmin } from "./scripts/seed-prod-admin";
import { initializeCronJobs } from "./utils/cron-jobs";
import { initializeEmailSystem } from "./utils/emailSystem";

const { PORT } = process.env;

if (!PORT) {
  console.error("❌ PORT environment variable is not set!");
  process.exit(1);
}

const app = express();

configureApp(app);
registerRoutes(app);

const server = app.listen(PORT, async () => {
  try {
    console.log(`✅ Server started on http://localhost:${PORT}`);

    // Neither of these is fatal. A server that refuses to boot without Redis
    // takes every non-email endpoint down with it.
    try {
      await seedProdAdmin();
    } catch (seedError) {
      console.error("❌ Prod admin seed error:", seedError);
    }

    try {
      await initializeEmailSystem();
    } catch (emailError) {
      console.error("❌ Email system initialization error:", emailError);
      console.warn("⚠️  Continuing without email functionality.");
    }

    try {
      await initializeCronJobs();
    } catch (cronError) {
      console.error("❌ Cron jobs initialization error:", cronError);
      console.warn("⚠️  Continuing without scheduled jobs.");
    }

    console.log("✅ Server initialization complete!");
  } catch (error) {
    console.error("❌ Error starting server:", error);
    process.exit(1);
  }
});

process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("✅ HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("✅ HTTP server closed");
    process.exit(0);
  });
});

initializeSocket(server);
