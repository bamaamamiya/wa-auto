// src/index.js

import { startWhatsApp } from "./bot/whatsappBot.js";
import { startSendAtWorker } from "./firebase/leadsListener.js";
import { startServer } from "./server.js";
import { startIncomingMessageListener } from "./bot/incomingMessageListener.js";
async function start() {
  console.log("🚀 Starting automation server...");

  const sock = await startWhatsApp();

  let initialized = false;

  sock.ev.on("connection.update", ({ connection }) => {
    console.log("📡 WA Connection:", connection);

    if (connection === "open" && !initialized) {
      console.log("✅ WhatsApp connected");

      startSendAtWorker();
			startIncomingMessageListener(sock);
      startServer(sock);

      initialized = true;

      console.log("🔥 System ready");
    }
  });
}

start();