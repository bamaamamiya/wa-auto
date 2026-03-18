import { startWhatsApp } from "./bot/whatsappBot.js";
import { startLeadsListener } from "./firebase/leadsListener.js";
import { startServer } from "./server.js";
async function start() {
  console.log("🚀 Starting automation server...");

  const sock = await startWhatsApp();

  sock.ev.on("connection.update", (update) => {
    const { connection } = update;

    if (connection === "open") {
      console.log("✅ WhatsApp connected");

      startLeadsListener(sock);
      startServer(sock);
    }
  });
}

start();
