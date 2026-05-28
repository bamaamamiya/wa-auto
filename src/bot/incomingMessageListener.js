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
import { isAddressConfirmation } from "../utils/messageDetector.js";
import { hasConfirmIntent } from "../utils/confirmationDetector.js";
import { buildProductFaqReply } from "../ai/productFaqResponder.js";
import { findProductForLead } from "../firebase/productRepository.js";
import { sendMessage } from "../utils/helpers.js";

const getIncomingChatId = (msg) => {
  return msg.key.remoteJidAlt || msg.key.participant || msg.key.remoteJid || "";
};

const safeUpdate = async (ref, data, retries = 5) => {
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      return await updateDoc(ref, data);
    } catch (e) {
      lastError = e;

      if (e.code !== "resource-exhausted") {
        throw e;
      }

      const wait = Math.min(1000 * 2 ** i, 10000);

      console.log(`Retry write (${i + 1}) in ${wait}ms`);

      await new Promise((r) => setTimeout(r, wait));
    }
  }

  throw lastError;
};

const findLeadByChat = async (chatId, sender) => {
  const conditions = [
    ["chatId", chatId],
    ["whatsapp", sender],
  ];

  for (const [field, value] of conditions) {
    const snap = await getDocs(
      query(collection(db, "leads"), where(field, "==", value), limit(1)),
    );

    if (!snap.empty) {
      return snap.docs[0];
    }
  }

  return null;
};

const timestampToMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
};

const canConfirmAddress = (lead, text) => {
  if (!lead) return false;

  if (lead.confirmation !== "belum") return false;

  if (lead.state !== "WAITING_CONFIRMATION") return false;

  if (lead.lastMessageState !== "WAITING_CONFIRMATION") return false;

  if (isAddressConfirmation(text)) {
    return true;
  }

  if (!hasConfirmIntent(text)) {
    return false;
  }

  const lastOrderMessageAt = timestampToMillis(lead.lastMessageAt);

  const lastAiReplyAt = timestampToMillis(lead.lastAiReplyAt);

  return lastAiReplyAt <= lastOrderMessageAt;
};

const replyWithFaqAi = async ({ sock, chatId, sender, leadDoc, question }) => {
  if (!leadDoc) {
    console.log("FAQ lead not found for:", chatId);
    return;
  }

  try {
    const lead = leadDoc.data();
    const lastReply = timestampToMillis(lead.lastAiReplyAt);
    if (Date.now() - lastReply < 3000) {
      console.log("Skip rapid reply");
      return;
    }
    const productDoc = await findProductForLead(lead);
    const product = productDoc?.data() || null;

    console.log("FAQ product context:", {
      found: !!product,
      productDocId: productDoc?.id || null,
      productId: product?.product_id || null,
      productName: product?.identity?.name || null,
    });

    const reply = await buildProductFaqReply({
      lead,
      product,
      question,
    });

    console.log("\n========== AI OUTPUT ==========");
    console.log(reply);
    console.log("===============================\n");

    if (!reply) {
      console.log("Empty AI reply:", leadDoc.id);
      return;
    }

    // TAMBAH DI SINI
    if (lead.lastAiQuestion === question && lead.lastAiReply === reply) {
      console.log("Skip duplicate reply");
      return;
    }
    console.log("\n========== WA SEND ==========");
    console.log(chatId);
    console.log(reply);
    console.log("=============================\n");

    await sendMessage(sock, chatId, reply);

    await safeUpdate(doc(db, "leads", leadDoc.id), {
      lastAiQuestion: question,
      lastAiReply: reply,
      lastAiReplyAt: serverTimestamp(),
    });

    console.log("FAQ AI replied:", sender);
  } catch (aiErr) {
    console.error("FAQ AI error:", aiErr.message);
  }
};

export const startIncomingMessageListener = (sock) => {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages?.[0];

      if (!msg) return;
      if (!msg.message) return;
      if (msg.key.fromMe) return;

      const rawChatId = getIncomingChatId(msg);

      if (!rawChatId) {
        console.log("Empty chatId");
        return;
      }

      if (rawChatId.includes("@g.us")) return;

      const chatId = jidNormalizedUser(rawChatId);

      const sender = chatId.replace("@s.whatsapp.net", "").replace(/\D/g, "");

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        "";

      const cleanText = text.trim();

      if (!cleanText) return;

      console.log("-------------------");
      console.log("Incoming Message");
      console.log("RAW:", rawChatId);
      console.log("CHAT ID:", chatId);
      console.log("SENDER:", sender);
      console.log("TEXT:", cleanText);

      const leadDoc = await findLeadByChat(chatId, sender);
      const leadData = leadDoc?.data();
      const addressConfirmed = canConfirmAddress(leadData, cleanText);

      console.log("CONFIRM DETECT:", hasConfirmIntent(cleanText));
      console.log("ADDRESS CONFIRM DETECT:", addressConfirmed);

      if (addressConfirmed) {
        if (!leadDoc) return;

        console.log("Lead Found:", leadDoc.id);

        await safeUpdate(doc(db, "leads", leadDoc.id), {
          confirmation: "sudah",
          state: "WAITING_UPSELL",
          queuedForMessage: true,
          nextSendAt: new Date(),
          updatedAt: serverTimestamp(),
        });

        console.log("Confirmation detected:", sender);

        return;
      }

      if (cleanText.length < 3) {
        return;
      }
      await replyWithFaqAi({
        sock,
        chatId,
        sender,
        leadDoc,
        question: cleanText,
      });

      console.log("Confirmation detected:", sender);
    } catch (err) {
      console.error("Incoming listener error:", err);
    }
  });
};
