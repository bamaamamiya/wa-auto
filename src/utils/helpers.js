import { getSock } from "../bot/whatsappBot.js";
import { isConnected } from "../states/connection.js";

const normalizeJid = (jid) => {
  if (jid === null || jid === undefined) {
    throw new Error("JID is empty");
  }

  // Kalau sudah string
  if (typeof jid === "string") {
    const value = jid.trim();

    if (!value) {
      throw new Error("JID is empty string");
    }

    return value;
  }

  // Kalau ternyata object memiliki field jid
  if (typeof jid === "object") {
    if (typeof jid.jid === "string") {
      return jid.jid.trim();
    }

    if (typeof jid.id === "string") {
      return jid.id.trim();
    }

    if (typeof jid.chatId === "string") {
      return jid.chatId.trim();
    }
  }

  throw new Error(
    `Invalid JID type: ${typeof jid} | value: ${JSON.stringify(jid)}`
  );
};

export const sendMessage = async (jid, message) => {
  if (!isConnected()) {
    console.log("⛔ Skip kirim, WA belum connect:", jid);
    throw new Error("WA not connected");
  }

  const sock = getSock();

  if (!sock) {
    throw new Error("Socket not available");
  }

  const normalizedJid = normalizeJid(jid);

  if (!normalizedJid.includes("@")) {
    throw new Error(`Invalid WhatsApp JID: ${normalizedJid}`);
  }

  try {
    console.log("📤 SEND MESSAGE:", {
      jid: normalizedJid,
      jidType: typeof normalizedJid,
      messageLength: message?.length || 0,
    });

    await sock.sendMessage(normalizedJid, {
      text: String(message ?? ""),
    });

    console.log("✅ Message sent:", normalizedJid);
  } catch (err) {
    console.log("❌ Error kirim:", {
      message: err.message,
      jid: normalizedJid,
      jidType: typeof normalizedJid,
    });

    throw err;
  }
};
