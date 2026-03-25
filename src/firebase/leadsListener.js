import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  limit,
} from "firebase/firestore";

import { buildOrderMessage } from "../templates/messageTemplate.js";
import { buildUpsellMessage } from "../templates/upsellTemplate.js";
import { sendMessage } from "../utils/helpers.js";

const leadsRef = collection(db, "leads");

export const startSendAtWorker = (bot) => {
  console.log("🚀 Worker starting...");

  // ❌ isActive dihapus
  const q = query(leadsRef, where("automation", "==", true),
	limit(10)

);

  onSnapshot(q, async (snapshot) => {
    const changes = snapshot.docChanges();

    for (const change of changes) {
      if (change.type !== "added" && change.type !== "modified") continue;

      const docSnap = change.doc;
      const data = docSnap.data();
      const leadId = docSnap.id;

      try {
        const now = Date.now();
        const delay = 15000; // 15detik

        const lastAt = data.lastMessageAt?.toMillis?.() || 0;
        const validStates = ["WAITING_CONFIRMATION", "WAITING_UPSELL"];

        // 🔥 CORE LOGIC
        const shouldSend =
          data.state && // ada state
          validStates.includes(data.state) && // state termasuk yang valid
          data.state !== data.lastMessageState && // belum pernah dikirim pesan untuk state ini
          now - lastAt > delay; // delay sudah lewat

        if (!shouldSend) {
          console.log("⏭️ Skip:", leadId);
          continue;
        }

        const chatId = formatPhone(data.whatsapp);

        let message = "";
        if (!data.state) {
          console.log("⏭️ Skip karena tidak ada state:", leadId);
          continue;
        }

        // 🔥 STATE MACHINE
        if (data.state === "WAITING_CONFIRMATION") {
          message = buildOrderMessage({
            name: data.name,
            productTitle: data.productTitle,
            price: data.price,
            ongkir: data.ongkir,
            addressClean: data.addressClean,
          });
        }

        if (data.state === "WAITING_UPSELL") {
          message = buildUpsellMessage(data);
        }

        if (!message) {
          console.log("⚠️ No message for state:", data.state);
          continue;
        }

        console.log("📤 Sending:", data.state, chatId);

        await sendMessage(bot, chatId, message);

        // ✅ UPDATE STATE SETELAH KIRIM
        await updateDoc(doc(db, "leads", leadId), {
          lastMessageState: data.state,
          lastMessageAt: serverTimestamp(),
        });

        console.log("✅ DONE:", leadId);
      } catch (err) {
        console.error("❌ ERROR:", leadId, err);
      }
    }
  });

  setInterval(() => {
    console.log("💓 Worker alive...");
  }, 30000);
};

const formatPhone = (phone) => {
  return phone.replace(/\D/g, "") + "@s.whatsapp.net";
};
