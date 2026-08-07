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
import { getProductAutomation } from "../utils/getProductAutomation.js";

const leadsRef = collection(db, "leads");

const MAX_RETRY = 3;
const PROCESSING_TIMEOUT = 30000;
const RETRY_DELAY = 15000;

export const startSendAtWorker = () => {
  console.log("🚀 Realtime Worker starting...");

  let isRunning = false;

  const q = query(
    leadsRef,
    where("aiStatus", "==", "QUEUED"),
    orderBy("createdAt"),
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

      const sleep = (ms) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      try {
        for (const docSnap of snapshot.docs) {
          await processLead(docSnap);

          // Random delay anti-spam
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
    /*
     * ============================================================
     * STEP 1
     * Ambil data lead terbaru + cek Product Automation Policy
     * ============================================================
     */

    const leadData = docSnap.data();

    if (leadData.aiStatus !== "QUEUED") {
      console.log("⏭️ Lead no longer queued:", leadId);
      return;
    }

    if (!leadData.productId) {
      console.log("❌ Product ID missing:", leadId);

      await updateDoc(doc(db, "leads", leadId), {
        aiStatus: "FAILED",
        isProcessing: false,
        aiProcessingAt: null,
        updatedAt: serverTimestamp(),
      });

      return;
    }

    const automationConfig = await getProductAutomation(
      leadData.productId,
    );

    if (!automationConfig) {
      console.log("❌ Automation config not found:", {
        leadId,
        productId: leadData.productId,
      });

      await updateDoc(doc(db, "leads", leadId), {
        aiStatus: "FAILED",
        isProcessing: false,
        aiProcessingAt: null,
        updatedAt: serverTimestamp(),
      });

      return;
    }

    const automation = automationConfig.automation || {};

    console.log("🤖 AUTOMATION POLICY:", {
      leadId,
      productId: leadData.productId,
      automation,
    });

    /*
     * ============================================================
     * STEP 2
     * PRODUCT POLICY GATE
     *
     * Product menentukan apakah AI boleh berjalan.
     * ============================================================
     */

    if (!automation.aiAgent) {
      console.log("⏭️ AI disabled for product:", {
        leadId,
        productId: leadData.productId,
      });

      await updateDoc(doc(db, "leads", leadId), {
        aiStatus: "SKIPPED",
        isProcessing: false,
        aiProcessingAt: null,
        updatedAt: serverTimestamp(),
      });

      return;
    }

    /*
     * ============================================================
     * STEP 3
     * LOCK LEAD
     *
     * Hanya setelah product policy mengizinkan AI,
     * kita lock lead sebagai PROCESSING.
     * ============================================================
     */

    const lockedData = await runTransaction(db, async (transaction) => {
      const ref = doc(db, "leads", leadId);

      const snap = await transaction.get(ref);

      if (!snap.exists()) {
        return null;
      }

      const data = snap.data();

      // Lead mungkin sudah diproses oleh worker lain.
      if (data.aiStatus !== "QUEUED") {
        return null;
      }

      const now = Date.now();

      const processingAt =
        data.aiProcessingAt?.toMillis?.() || 0;

      /*
       * Kalau masih PROCESSING dan belum timeout,
       * jangan ambil alih.
       */
      if (
        data.isProcessing &&
        now - processingAt < PROCESSING_TIMEOUT
      ) {
        console.log("🔒 Still processing:", leadId);
        return null;
      }

      /*
       * Retry limit
       */
      const retryCount = data.aiRetryCount || 0;

      if (retryCount >= MAX_RETRY) {
        console.log("❌ AI retry limit:", leadId);

        transaction.update(ref, {
          aiStatus: "FAILED",
          isProcessing: false,
          aiProcessingAt: null,
          updatedAt: serverTimestamp(),
        });

        return null;
      }

      /*
       * LOCK
       */
      transaction.update(ref, {
        aiStatus: "PROCESSING",
        isProcessing: true,
        aiProcessingAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return data;
    });

    if (!lockedData) {
      return;
    }

    /*
     * ============================================================
     * STEP 4
     * CHECK WHATSAPP CONNECTION
     * ============================================================
     */

    const bot = getSock();

    console.log("🔎 BOT CHECK:", {
      hasBot: !!bot,
      botUser: bot?.user,
      connected: isConnected(),
    });

    if (!bot || !isConnected()) {
      console.log("⛔ WA not connected:", lockedData.whatsapp);

      await updateDoc(doc(db, "leads", leadId), {
        aiStatus: "QUEUED",
        isProcessing: false,
        aiProcessingAt: null,
        nextSendAt: Timestamp.fromMillis(
          Date.now() + RETRY_DELAY,
        ),
        updatedAt: serverTimestamp(),
      });

      return;
    }

    /*
     * ============================================================
     * STEP 5
     * BUILD ORDER NOTIFICATION
     * ============================================================
     */

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
        aiStatus: "FAILED",
        isProcessing: false,
        aiProcessingAt: null,
        updatedAt: serverTimestamp(),
      });

      return;
    }

    /*
     * ============================================================
     * STEP 6
     * SEND ORDER NOTIFICATION
     * ============================================================
     */

    console.log("📤 Sending Order Notification:", {
      leadId,
      chatId,
    });

    await sendMessage(chatId, message);

    console.log("✅ Message sent:", leadId);

    /*
     * ============================================================
     * STEP 7
     * MARK SUCCESS
     * ============================================================
     */

    await updateDoc(doc(db, "leads", leadId), {
      chatId,

      aiStatus: "SENT",

      isProcessing: false,
      aiProcessingAt: null,

      aiLastSentAt: serverTimestamp(),
      aiRetryCount: 0,

      updatedAt: serverTimestamp(),
    });

    console.log("✅ AI DONE:", leadId);
  } catch (err) {
    console.error("❌ PROCESS ERROR:", {
      leadId,
      message: err.message,
      stack: err.stack,
    });

    /*
     * ============================================================
     * ERROR / RETRY
     * ============================================================
     */

    try {
      const leadRef = doc(db, "leads", leadId);

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(leadRef);

        if (!snap.exists()) return;

        const data = snap.data();

        const currentRetry = data.aiRetryCount || 0;
        const nextRetry = currentRetry + 1;

        if (nextRetry >= MAX_RETRY) {
          transaction.update(leadRef, {
            aiStatus: "FAILED",
            isProcessing: false,
            aiProcessingAt: null,
            aiRetryCount: nextRetry,
            updatedAt: serverTimestamp(),
          });

          console.log("❌ AI FAILED permanently:", {
            leadId,
            retryCount: nextRetry,
          });

          return;
        }

        transaction.update(leadRef, {
          aiStatus: "QUEUED",
          isProcessing: false,
          aiProcessingAt: null,

          aiRetryCount: nextRetry,

          nextSendAt: Timestamp.fromMillis(
            Date.now() + RETRY_DELAY,
          ),

          updatedAt: serverTimestamp(),
        });

        console.log("🔄 AI retry scheduled:", {
          leadId,
          retryCount: nextRetry,
        });
      });
    } catch (updateErr) {
      console.error(
        "❌ Failed update AI retry:",
        updateErr,
      );
    }
  }
};

const formatPhone = (phone) => {
  return phone.replace(/\D/g, "") + "@s.whatsapp.net";
};