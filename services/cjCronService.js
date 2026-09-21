import cron from "node-cron";
import { runFullCjInventorySync } from "./cjSyncService.js";

/**
 * Initialize background cron jobs for CJ Dropshipping
 */
export const initCjCronJobs = () => {
  // Run once daily at 02:00 AM (server local time)
  // Can be customized via env: CJ_SYNC_CRON
  const cronExpression = process.env.CJ_SYNC_CRON || "0 2 * * *";

  console.log(`[CJ Cron] Initializing inventory & price sync schedule: "${cronExpression}"`);

  cron.schedule(cronExpression, async () => {
    console.log("[CJ Cron] Triggering scheduled CJ inventory & price sync...");
    try {
      const result = await runFullCjInventorySync();
      console.log("[CJ Cron] Scheduled sync finished successfully:", result.message);
    } catch (err) {
      console.error("[CJ Cron] Scheduled sync encountered an error:", err);
    }
  });
};
