import { db } from "./firebase.js";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { buildOrderMessage } from "../templates/messageTemplate.js";
import { sendMessage } from "../utils/helpers.js";
import { Timestamp } from "firebase/firestore";

const leadsRef = collection(db, "leads");

export const startSendAtWorker = async (bot) => {
  console.log("👀 Worker SendAt aktif...");

  setInterval(async () => {
    const now = Timestamp.now()

    // query semua leads yang ready untuk dikirim
    const q = query(
      leadsRef,
      where("automation", "==", true),
      where("messageSent", "==", false),
      where("sendAt", "<=", now)
    );

    const snapshot = await getDocs(q);

    snapshot.forEach(async (docSnap) => {
      const data = docSnap.data();
      const leadId = docSnap.id;

      const chatId = formatPhone(data.whatsapp);
      const message = buildOrderMessage({
        name: data.name,
        productTitle: data.productTitle,
        price: data.price,
        ongkir: data.ongkir,
        addressClean: data.addressClean,
      });

      // LOCK biar ga double-send
      await updateDoc(doc(db, "leads", leadId), { messageSent: "processing" });

      try {
        await sendMessage(bot, chatId, message);

        await updateDoc(doc(db, "leads", leadId), {
          messageSent: true,
          messageSentAt: new Date(),
        });

        console.log("✅ Pesan terkirim:", chatId);
      } catch (err) {
        console.error("❌ Error kirim:", chatId, err);
        await updateDoc(doc(db, "leads", leadId), { messageSent: false });
      }
    });
  }, 10000); // cek tiap 10 detik
};

const formatPhone = (phone) => phone.replace(/\D/g, "") + "@s.whatsapp.net";