// src/index.js

import { startWhatsApp } from "./bot/whatsappBot.js";
import { startSendAtWorker } from "./firebase/leadsListener.js";
import { startServer } from "./server.js";
import { startIncomingMessageListener } from "./bot/incomingMessageListener.js";
// import { startScheduler } from "./bot/scheduler.js";

async function start() {
  console.log("🚀 Starting automation server...");

  const sock = await startWhatsApp();

  let initialized = false;

  sock.ev.on("connection.update", ({ connection }) => {
    console.log("📡 WA Connection:", connection);

    if (connection !== "open") return;

    if (initialized) {
      console.log("⚡ Services already running");
      return;
    }

    initialized = true;

    console.log("✅ WhatsApp connected");
    startSendAtWorker();
    startIncomingMessageListener(sock);
    // reminder confirmation
    // startScheduler(sock);
    startServer(sock);

    console.log("🔥 System ready");
  });
}

start();
