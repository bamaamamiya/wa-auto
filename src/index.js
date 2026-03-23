// src/index.js
import { startWhatsApp } from "./bot/whatsappBot.js";
import { startSendAtWorker } from "./firebase/leadsListener.js";
import { startServer } from "./server.js";
async function start() {
  console.log("🚀 Starting automation server...");

  const sock = await startWhatsApp();
	let isInitialized = false;

  sock.ev.on("connection.update", (update) => {
    const { connection } = update;

    if (connection === "open" && !isInitialized) {
      console.log("✅ WhatsApp connected");

      startSendAtWorker(sock);
      startServer(sock);

      isInitialized = true;
    }
  });
}

start();
