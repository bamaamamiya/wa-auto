import {
  collection,
  query,
  where,
  getDocs,
  limit,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import { jidNormalizedUser } from "@whiskeysockets/baileys";

import { db } from "../firebase/firebase.js";
import { isConfirmation } from "../utils/messageDetector.js";

// helper
const getIncomingChatId = (msg) => {
  return (
    msg.key.remoteJidAlt ||
    msg.key.participant ||
    msg.key.remoteJid ||
    ""
  );
};

export const startIncomingMessageListener = (sock) => {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages?.[0];

      if (!msg) return;

      // ignore empty
      if (!msg.message) return;

      // ignore from bot
      if (msg.key.fromMe) return;

      const rawChatId = getIncomingChatId(msg);

      if (!rawChatId) {
        console.log("❌ Empty chatId");
        return;
      }

      // ignore group
      if (rawChatId.includes("@g.us")) return;

      // normalize jid
      const chatId = jidNormalizedUser(rawChatId);

      const sender = chatId
        .replace("@s.whatsapp.net", "")
        .replace(/\D/g, "");

      // extract text
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        "";

      console.log("━━━━━━━━━━━━━━━━━━━");
      console.log("📩 Incoming Message");
      console.log("📩 RAW:", rawChatId);
      console.log("📩 CHAT ID:", chatId);
      console.log("📩 SENDER:", sender);
      console.log("📩 TEXT:", text);

      // detect confirmation
      const confirmed = isConfirmation(text);

      console.log("🧠 CONFIRM DETECT:", confirmed);

      if (!confirmed) return;

      // search by chatId
      const q = query(
        collection(db, "leads"),
        where("chatId", "==", chatId),
        where("confirmation", "==", "belum"),
        limit(1),
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log("❌ Lead not found for:", chatId);
        return;
      }

      const leadDoc = snapshot.docs[0];

      console.log("✅ Lead Found:", leadDoc.id);

      // update lead
      await updateDoc(doc(db, "leads", leadDoc.id), {
        confirmation: "sudah",

        state: "WAITING_UPSELL",

        queuedForMessage: true,

        nextSendAt: new Date(),

        updatedAt: serverTimestamp(),
      });

      console.log("✅ Confirmation detected:", sender);
    } catch (err) {
      console.error("❌ Incoming listener error:", err);
    }
  });
};