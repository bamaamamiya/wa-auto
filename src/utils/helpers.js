import { isConnected } from "../states/connection.js";
export const sendMessage = async (bot, jid, message) => {
  if (!isConnected) {
    console.log("⛔ Skip kirim, WA belum connect:", jid);
    throw new Error("WA not connected");
  }

  try {
    await bot.sendMessage(jid, { text: message });
  } catch (err) {
    console.log("❌ Error kirim:", err.message);
    throw err;
  }
};
