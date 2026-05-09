// src/firebase/leadsListener.js

import { db } from "./firebase.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
  limit,
  runTransaction,
  Timestamp,
} from "firebase/firestore";

import { isConnected } from "../states/connection.js";
import { buildOrderMessage } from "../templates/messageTemplate.js";
import { sendMessage } from "../utils/helpers.js";
import { getSock } from "../bot/whatsappBot.js";

const leadsRef = collection(db, "leads");

export const startSendAtWorker = () => {
  console.log("🚀 Realtime Worker starting...");

  let isRunning = false;

  const q = query(
    leadsRef,
    where("automation", "==", true),
    where("queuedForMessage", "==", true),
    where("state", "==", "WAITING_CONFIRMATION"),
    orderBy("nextSendAt"),
    limit(5),
  );

  onSnapshot(
    q,
    async (snapshot) => {
      console.log("📥 Snapshot triggered:", snapshot.size);

      snapshot.docs.forEach((d) => {
        console.log("📄 DOC:", d.id, d.data());
      });

      if (snapshot.empty) return;

      if (isRunning) {
        console.log("⏳ Worker busy...");
        return;
      }

      isRunning = true;

      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

      try {
        for (const docSnap of snapshot.docs) {
          await processLead(docSnap);

          // random delay anti spam
          const delay = Math.floor(Math.random() * 8000) + 3000;
					
          console.log(`😴 Sleep ${delay}ms`);
          await sleep(delay);
        }
      } catch (err) {
        console.error("❌ Snapshot Worker Error:", err);
      } finally {
        isRunning = false;
      }
    },
    (err) => {
      console.error("❌ Firestore Listener Error:", err);
    },
  );

  console.log("💓 Worker listening...");
};

const processLead = async (docSnap) => {
  const leadId = docSnap.id;

  try {
    const lockedData = await runTransaction(db, async (transaction) => {
      const ref = doc(db, "leads", leadId);

      const snap = await transaction.get(ref);

      if (!snap.exists()) return null;

      const data = snap.data();

      const now = Date.now();

      const lastAt = data.lastMessageAt?.toMillis?.() || 0;
      const nextSend = data.nextSendAt?.toMillis?.() || 0;
      const processingAt = data.isProcessingAt?.toMillis?.() || 0;

      const delay = 15000;

      // validation
      if (data.state !== "WAITING_CONFIRMATION") return null;

      if (!data.queuedForMessage) return null;

      if (now < nextSend) return null;

      if (now - lastAt < delay) return null;

      // lock protection
      if (data.isProcessing && now - processingAt < 30000) {
        console.log("🔒 Still processing:", leadId);
        return null;
      }

      // retry limit
      if ((data.retryCount || 0) >= 3) {
        console.log("❌ Retry limit:", leadId);

        transaction.update(ref, {
          state: "FAILED",
          isProcessing: false,
        });

        return null;
      }

      // anti duplicate
      if (data.lastMessageState === data.state) {
        console.log("⏭️ Already sent:", leadId);
        return null;
      }

      // LOCK
      transaction.update(ref, {
        isProcessing: true,
        isProcessingAt: serverTimestamp(),
      });

      return data;
    });

    if (!lockedData) return;

    const bot = getSock();

    console.log("🔎 BOT CHECK:", {
      hasBot: !!bot,
      botUser: bot?.user,
      connected: isConnected(),
    });

    if (!bot || !isConnected()) {
      console.log("⛔ WA not connected:", lockedData.whatsapp);

      await updateDoc(doc(db, "leads", leadId), {
        isProcessing: false,

        // retry lagi 15 detik
        nextSendAt: Timestamp.fromMillis(Date.now() + 15000),
      });

      return;
    }

    const chatId = formatPhone(lockedData.whatsapp);

    const message = buildOrderMessage({
      name: lockedData.name,
      productTitle: lockedData.productTitle,
      price: lockedData.price,
      ongkir: lockedData.ongkir,
      addressClean: lockedData.addressClean,
    });

    if (!message) {
      console.log("❌ Empty message:", leadId);

      await updateDoc(doc(db, "leads", leadId), {
        isProcessing: false,
      });

      return;
    }

    console.log("📤 Sending:", {
      leadId,
      chatId,
    });

    await sendMessage(bot, chatId, message);

    console.log("✅ Message sent:", leadId);

    await updateDoc(doc(db, "leads", leadId), {
      state: "DONE",

      lastMessageState: "WAITING_CONFIRMATION",

      lastMessageAt: serverTimestamp(),

      queuedForMessage: false,

      isProcessing: false,

      retryCount: 0,
    });

    console.log("✅ DONE:", leadId);
  } catch (err) {
    console.error("❌ PROCESS ERROR:", {
      leadId,
      message: err.message,
      stack: err.stack,
    });

    try {
      await updateDoc(doc(db, "leads", leadId), {
        isProcessing: false,

        retryCount: (docSnap.data().retryCount || 0) + 1,

        nextSendAt: Timestamp.fromMillis(Date.now() + 15000),
      });
    } catch (updateErr) {
      console.error("❌ Failed update retry:", updateErr);
    }
  }
};

const formatPhone = (phone) => {
  return phone.replace(/\D/g, "") + "@s.whatsapp.net";
};
