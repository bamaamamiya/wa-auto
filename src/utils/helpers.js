import { getSock } from "../bot/whatsappBot.js";
import { isConnected } from "../states/connection.js";

export const sendMessage = async (jid, message) => {
  if (!isConnected()) {
    console.log("⛔ Skip kirim, WA belum connect:", jid);
    throw new Error("WA not connected");
  }

  const sock = getSock();

  if (!sock) {
    throw new Error("Socket not available");
  }

  try {
    await sock.sendMessage(jid, { text: message });
  } catch (err) {
    console.log("❌ Error kirim:", err.message);
    throw err;
  }
};
