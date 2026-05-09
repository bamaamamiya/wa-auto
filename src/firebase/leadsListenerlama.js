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
} from "firebase/firestore";

import { buildOrderMessage } from "../templates/messageTemplate.js";
import { buildUpsellMessage } from "../templates/upsellTemplate.js";
import { sendMessage } from "../utils/helpers.js";

const leadsRef = collection(db, "leads");

export const startSendAtWorker = (bot) => {
  console.log("🚀 Realtime Worker starting...");

  const q = query(
    leadsRef,
    where("automation", "==", true),
    where("queuedForMessage", "==", true),
    where("state", "==", "WAITING_CONFIRMATION"),
    orderBy("nextSendAt"),
    limit(5)
  );

  onSnapshot(q, async (snapshot) => {
    if (snapshot.empty) return;

    console.log("🔥 Trigger:", snapshot.size);

    await Promise.all(
      snapshot.docs.map((docSnap) => processLead(docSnap, bot))
    );
  });

  console.log("💓 Worker listening...");
};

const processLead = async (docSnap, bot) => {
  const leadId = docSnap.id;

  try {
    // 🔒 ===== TRANSACTION LOCK =====
    const lockedData = await runTransaction(db, async (transaction) => {
      const ref = doc(db, "leads", leadId);
      const snap = await transaction.get(ref);

      if (!snap.exists()) return null;

      const data = snap.data();

      const now = Date.now();
      const delay = 15000;

      const lastAt = data.lastMessageAt?.toMillis?.() || 0;
      const nextSend = data.nextSendAt?.toMillis?.() || 0;
      const processingAt = data.isProcessingAt?.toMillis?.() || 0;

      const validStates = ["WAITING_CONFIRMATION", "WAITING_UPSELL"];

      // 🚫 VALIDASI
      if (!data.state || !validStates.includes(data.state)) return null;
      if (!data.queuedForMessage) return null;
      if (now < nextSend) return null;
      if (now - lastAt < delay) return null;

      // 🚫 LOCK CHECK
      if (data.isProcessing && now - processingAt < 30000) return null;

      // 🚫 MAX RETRY
      if ((data.retryCount || 0) >= 3) return null;

      // 🚫 SUDAH DIKIRIM
      if (data.lastMessageState === data.state) return null;

      // 🔒 LOCK
      transaction.update(ref, {
        isProcessing: true,
        isProcessingAt: serverTimestamp(),
      });

      return data;
    });

    // 🚫 kalau gagal lock → stop
    if (!lockedData) return;

    const chatId = formatPhone(lockedData.whatsapp);

    let message = "";

    // =========================
    // 🧠 STATE MACHINE
    // =========================
    if (lockedData.state === "WAITING_CONFIRMATION") {
      message = buildOrderMessage({
        name: lockedData.name,
        productTitle: lockedData.productTitle,
        price: lockedData.price,
        ongkir: lockedData.ongkir,
        addressClean: lockedData.addressClean,
      });
    }

    else if (lockedData.state === "WAITING_UPSELL") {
      const canUpsell =
        lockedData.upsellEnabled &&
        lockedData.upsells &&
        lockedData.upsells.length > 0;

      if (!canUpsell) {
        console.log("❌ No upsell:", leadId);

        await updateDoc(doc(db, "leads", leadId), {
          state: "DONE",
          queuedForMessage: false,
          isProcessing: false,
        });

        return;
      }

      message = buildUpsellMessage(lockedData);
    }

    if (!message) return;

    console.log("📤 Sending:", lockedData.state, leadId);

    await sendMessage(bot, chatId, message);

    // =========================
    // ✅ AFTER SEND
    // =========================
    let updatePayload = {
      lastMessageState: lockedData.state,
      lastMessageAt: serverTimestamp(),
      queuedForMessage: false,
      isProcessing: false,
      retryCount: 0,
    };

    // 🔥 DECISION ENGINE
    if (lockedData.state === "WAITING_CONFIRMATION") {
      const canUpsell =
        lockedData.upsellEnabled &&
        lockedData.upsells &&
        lockedData.upsells.length > 0;

      if (canUpsell) {
        updatePayload.state = "WAITING_UPSELL";
        updatePayload.queuedForMessage = true;
        updatePayload.nextSendAt = serverTimestamp();
      } else {
        updatePayload.state = "DONE";
      }
    }

    if (lockedData.state === "WAITING_UPSELL") {
      updatePayload.state = "DONE";
    }

    await updateDoc(doc(db, "leads", leadId), updatePayload);

    console.log("✅ DONE:", leadId);

  } catch (err) {
    console.error("❌ ERROR:", leadId, err);

    await updateDoc(doc(db, "leads", leadId), {
      isProcessing: false,
      queuedForMessage: false,
      state: "ERROR",
      retryCount: (docSnap.data().retryCount || 0) + 1,
    });
  }
};

const formatPhone = (phone) =>
  phone.replace(/\D/g, "") + "@s.whatsapp.net";