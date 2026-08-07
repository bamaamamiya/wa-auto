// src/index.js

import { startWhatsApp } from "./bot/whatsappBot.js";
import { startSendAtWorker } from "./firebase/leadsListener.js";
import { startServer } from "./server.js";
import { startIncomingMessageListener } from "./bot/incomingMessageListener.js";
import { startScheduler } from "./bot/scheduler.js";
import { setConnected } from "./states/connection.js";
import { log } from "./utils/logger.js";
export const features = {
  whatsapp: true,
  sendAtWorker: true,
  incomingMessageListener: true,
  addressConfirmation: false,
  confirmationReminderScheduler: false,
  apiServer: true,
};

let servicesInitialized = false;
let reconnecting = false;
let removeIncomingListener = null;

const logFeatureStatus = () => {
  log.debug(features);
};

const runFeature = (name, callback) => {
  if (!features[name]) {
		log.warn(`Feature disabled: ${name}`);
    return;
  }

  callback();
};

async function shutdown() {
  log.warn("Shutdown...");

  setConnected(false);

  if (removeIncomingListener) {
    removeIncomingListener();
  }

  process.exit(0);
}

async function connectWhatsApp() {
  const sock = await startWhatsApp();

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection) {
      log.wa(`Connection: ${connection}`);
    }

    if (connection === "open") {
      reconnecting = false;
      setConnected(true);

      log.success("WhatsApp connected");

      // Service cukup dijalankan sekali
      if (!servicesInitialized) {
        servicesInitialized = true;

        runFeature("sendAtWorker", () => startSendAtWorker());

        runFeature("confirmationReminderScheduler", () => startScheduler(sock));

        runFeature("apiServer", () => startServer());

        log.success("Background services started");
      }

      runFeature("incomingMessageListener", () => {
        if (removeIncomingListener) {
          removeIncomingListener();
          removeIncomingListener = null;
        }

        removeIncomingListener = startIncomingMessageListener(sock, {
          addressConfirmation: features.addressConfirmation,
        });
      });

      log.success("System ready");
      return;
    }

    if (connection === "close") {
      setConnected(false);

      log.wa("Disconnected");

      if (lastDisconnect?.error) {
        log.error(lastDisconnect.error);
      }

      if (reconnecting) {
        log.warn("Reconnect already in progress...");
        return;
      }

      reconnecting = true;

      log.info("Reconnecting in 5 seconds...");

      setTimeout(async () => {
        try {
          await connectWhatsApp();
        } catch (err) {
          log.error("Reconnect failed:", err);
          reconnecting = false;
        }
      }, 5000);
    }
  });
}

async function start() {
  console.log("================================");
  log.info("🚀 Starting automation server...");
  console.log("================================");

  logFeatureStatus();

  if (!features.whatsapp) {
    console.log("Feature disabled: whatsapp");
    return;
  }

  try {
    await connectWhatsApp();
  } catch (err) {
    log.error("Failed to start WhatsApp", err);
    process.exit(1);
  }
}

start();

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
