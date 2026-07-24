// src/index.js

import { startWhatsApp } from "./bot/whatsappBot.js";
import { startSendAtWorker } from "./firebase/leadsListener.js";
import { startServer } from "./server.js";
import { startIncomingMessageListener } from "./bot/incomingMessageListener.js";
import { startScheduler } from "./bot/scheduler.js";

const features = {
  whatsapp: true,
  sendAtWorker: true,
  incomingMessageListener: true,
  addressConfirmation: true,
  productFaqAi: true,
  confirmationReminderScheduler: false,
  apiServer: true,
};

const logFeatureStatus = () => {
  console.log("Feature flags:", features);
};

const runFeature = (name, callback) => {
  if (!features[name]) {
    console.log(`Feature disabled: ${name}`);
    return;
  }

  callback();
};

async function start() {
  console.log("Starting automation server...");
  logFeatureStatus();

  if (!features.whatsapp) {
    console.log("Feature disabled: whatsapp");
    return;
  }

  const sock = await startWhatsApp();

  let initialized = false;

  sock.ev.on("connection.update", ({ connection }) => {
    console.log("WA Connection:", connection);

    if (connection !== "open") return;

    if (initialized) {
      console.log("Services already running");
      return;
    }

    initialized = true;

    console.log("WhatsApp connected");
    runFeature("sendAtWorker", () => startSendAtWorker());
    runFeature("incomingMessageListener", () =>
      startIncomingMessageListener(sock, {
        addressConfirmation: features.addressConfirmation,
        productFaqAi: features.productFaqAi,
      }),
    );
    runFeature("confirmationReminderScheduler", () => startScheduler(sock));
    runFeature("apiServer", () => startServer(sock));

    console.log("System ready");
  });
}

start();
