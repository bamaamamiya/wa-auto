import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase.js";
import { sendMessage } from "../utils/helpers.js";

export const processConfirmationReminder = async (sock) => {
  try {
    const now = new Date();

    const snap = await getDocs(
      query(
        collection(db, "leads"),
        where("confirmation", "==", "belum"),
        where("state", "==", "WAITING_CONFIRMATION"),
        where("automation", "==", true),
      ),
    );

    for (const leadDoc of snap.docs) {
      const lead = leadDoc.data();

      // skip kalau sudah pernah reminder
      if ((lead.reminderCount || 0) >= 1) continue;

      // skip kalau belum ada lastMessageAt
      if (!lead.lastMessageAt) continue;

      const lastMessageAt = lead.lastMessageAt.toMillis?.() || 0;
      const twoHours = 2 * 60 * 60 * 1000;

      // skip kalau belum 2 jam
      if (now - lastMessageAt < twoHours) continue;

      // skip kalau tidak ada chatId
      if (!lead.chatId) continue;

      await sendMessage(
        sock,
        lead.chatId,
        "Halo kak 🙏 Kami ingin memastikan pesanan kakak sudah dikonfirmasi. Jika alamat sudah benar cukup balas: iya / sudah benar / lanjut ya kak 🙏",
      );

      await updateDoc(doc(db, "leads", leadDoc.id), {
        reminderCount: 1,
        lastReminderAt: serverTimestamp(),
      });

      console.log("Reminder sent:", lead.whatsapp);
    }
  } catch (e) {
    console.log("Reminder error", e);
  }
};
