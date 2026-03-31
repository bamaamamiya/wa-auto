import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  limit,
  orderBy,
} from "firebase/firestore";

import { buildOrderMessage } from "../templates/messageTemplate.js";
import { buildUpsellMessage } from "../templates/upsellTemplate.js";
import { sendMessage } from "../utils/helpers.js";

const leadsRef = collection(db, "leads");

export const startSendAtWorker = (bot) => {
  console.log("🚀 Worker starting...");

  const processBatch = async () => {
    try {
      const q = query(
        leadsRef,
        where("automation", "==", true),
        where("queuedForMessage", "==", true),
        where("nextSendAt", "<=", new Date()),
        orderBy("nextSendAt"),
        limit(10),
      );

      const snapshot = await getDocs(q);

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const leadId = docSnap.id;
				
        const now = Date.now();
        const delay = 15000;
        const lastAt = data.lastMessageAt?.toMillis?.() || 0;

        const validStates = ["WAITING_CONFIRMATION", "WAITING_UPSELL"];

				  // 🚫 VALIDATION
        if (
          !data.state ||
          !validStates.includes(data.state) ||
          now - lastAt < delay
        ) {
          console.log("⏭️ Skip:", leadId);
          continue;
        }

        const chatId = formatPhone(data.whatsapp);
        let message = "";

        if (data.state === "WAITING_CONFIRMATION") {
          message = buildOrderMessage({
            name: data.name,
            productTitle: data.productTitle,
            price: data.price,
            ongkir: data.ongkir,
            addressClean: data.addressClean,
          });
        } else if (data.state === "WAITING_UPSELL") {
          message = buildUpsellMessage(data);
        }

        if (!message) continue;

        console.log("📤 Sending:", data.state, chatId);
        await sendMessage(bot, chatId, message);

        // ✅ Update lead setelah kirim
        await updateDoc(doc(db, "leads", leadId), {
          lastMessageState: data.state,
          lastMessageAt: serverTimestamp(),
          queuedForMessage: false, // set false biar gak dikirim lagi
        });

        console.log("✅ DONE:", leadId);
      }
    } catch (err) {
      console.error("❌ ERROR batch:", err);
    }
  };

  // jalankan batch tiap 5 detik
  setInterval(processBatch, 30000);
  console.log("💓 Worker alive...");
};

const formatPhone = (phone) => phone.replace(/\D/g, "") + "@s.whatsapp.net";
