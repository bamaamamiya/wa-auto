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
     ),
   );

   for (const leadDoc of snap.docs) {
     const lead = leadDoc.data();

     if (!lead.reminderConfig?.enabled) continue;

     const max =
       lead.reminderConfig.maxReminder || 1;

     if ((lead.reminderCount || 0) >= max) continue;

     const next =
       lead.nextReminderAt?.toDate?.();

     if (!next || next > now) continue;

     await sendMessage(
       sock,
       lead.chatId,
`
Halo kak 🙏
Kami ingin memastikan alamat pesanan sudah sesuai.

Jika alamat sudah benar cukup balas:
• iya
• sudah benar
• lanjut

Jika ada revisi cukup kirim alamat yang benar ya kak
`.trim(),
     );

     await updateDoc(
       doc(db, "leads", leadDoc.id),
       {
         reminderCount:
           (lead.reminderCount || 0) + 1,

         nextReminderAt: new Date(
           Date.now() +
             lead.reminderConfig.intervalMinute *
               60000,
         ),

         updatedAt: serverTimestamp(),
       },
     );
   }
 } catch (e) {
   console.log("Reminder error", e);
 }
};