import { getRegisteredHandlersCount, initializeEmailWorker, isWorkerReady } from "../workers/globalEmailQueueHandler";
import { initializeEmailHandlers } from "../workers/registerWorkers";

export const initializeEmailSystem = async (): Promise<boolean> => {
  console.log("🔧 Initializing email system...");

  initializeEmailHandlers();
  console.log(`📝 Registered ${getRegisteredHandlersCount()} email handlers`);

  initializeEmailWorker();

  let attempts = 0;
  const maxAttempts = 10;

  while (!isWorkerReady() && attempts < maxAttempts) {
    console.log(`⏳ Waiting for email worker... (${attempts + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  if (!isWorkerReady()) throw new Error("Email worker failed to start within timeout");

  console.log("✅ Email system initialized successfully");

  return true;
};
