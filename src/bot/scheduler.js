import cron from "node-cron";

import {
 processConfirmationReminder,
} from "./confirmationReminder.js";

export const startScheduler = (sock) => {
 cron.schedule("* * * * *", async () => {
   await processConfirmationReminder(sock);
 });
};