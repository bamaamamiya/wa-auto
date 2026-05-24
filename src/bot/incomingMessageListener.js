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
import {
  isAddressConfirmation,
  isConfirmation,
} from "../utils/messageDetector.js";
import { buildProductFaqReply } from "../ai/productFaqResponder.js";
import { findProductForLead } from "../firebase/productRepository.js";
import { sendMessage } from "../utils/helpers.js";

const getIncomingChatId = (msg) => {
  return msg.key.remoteJidAlt || msg.key.participant || msg.key.remoteJid || "";
};

const findLeadByChat = async (chatId, sender) => {
  const byChatId = query(
    collection(db, "leads"),
    where("chatId", "==", chatId),
    limit(1),
  );

  const chatSnapshot = await getDocs(byChatId);

  if (!chatSnapshot.empty) {
    return chatSnapshot.docs[0];
  }

  const byWhatsapp = query(
    collection(db, "leads"),
    where("whatsapp", "==", sender),
    limit(1),
  );

  const phoneSnapshot = await getDocs(byWhatsapp);

  if (!phoneSnapshot.empty) {
    return phoneSnapshot.docs[0];
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

  if (isAddressConfirmation(text)) return true;
  if (!isConfirmation(text)) return false;

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

    console.log("\n========== WA SEND ==========");
    console.log(chatId);
    console.log(reply);
    console.log("=============================\n");

    await sendMessage(sock, chatId, reply);

    await updateDoc(doc(db, "leads", leadDoc.id), {
      lastAiQuestion: question,
      lastAiReply: reply,
      lastAiReplyAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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
      const confirmed = isConfirmation(cleanText);
      const addressConfirmed = canConfirmAddress(leadData, cleanText);

      console.log("CONFIRM DETECT:", confirmed);
      console.log("ADDRESS CONFIRM DETECT:", addressConfirmed);

      if (!addressConfirmed) {
        await replyWithFaqAi({
          sock,
          chatId,
          sender,
          leadDoc,
          question: cleanText,
        });

        return;
      }

      console.log("Lead Found:", leadDoc.id);

      await updateDoc(doc(db, "leads", leadDoc.id), {
        confirmation: "sudah",
        state: "WAITING_UPSELL",
        queuedForMessage: true,
        nextSendAt: new Date(),
        updatedAt: serverTimestamp(),
      });

      console.log("Confirmation detected:", sender);
    } catch (err) {
      console.error("Incoming listener error:", err);
    }
  });
};
