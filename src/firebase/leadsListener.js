import { db } from "./firebase.js";
import { collection, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { buildOrderMessage } from "../templates/messageTemplate.js";
import { sendMessage } from "../utils/helpers.js";

const leadsRef = collection(db, "leads");

const randomDelay = () => {
  const min = 50000; // 50 detik
  const max = 70000; // 70 detik
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const startLeadsListener = (bot) => {
  console.log("👀 Listener Firebase aktif...");

  onSnapshot(leadsRef, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type !== "added") return;

      const data = change.doc.data();
      const leadId = change.doc.id;

      // Validasi data penting
      if (!data.whatsapp) return;
      if (data.automation !== true) return;
      if (data.messageSent !== false) return;
      if (!data.productTitle) return;

      const chatId = formatPhone(data.whatsapp);

      const message = buildOrderMessage({
        name: data.name,
        productTitle: data.productTitle,
        price: data.price,
        ongkir: data.ongkir,
        addressClean: data.addressClean,
      });

      const delay = randomDelay();

      console.log(
        `⏳ Menunggu ${Math.round(delay / 1000)} detik sebelum kirim ke ${chatId}`,
      );

      setTimeout(async () => {
        try {
          await sendMessage(bot, chatId, message);

          await updateDoc(doc(db, "leads", leadId), {
            messageSent: true,
            messageSentAt: new Date(),
          });

          console.log("✅ Pesan terkirim:", chatId);
        } catch (err) {
          console.error("❌ Gagal kirim pesan:", err);
        }
      }, delay);
    });
  });
};

const formatPhone = (phone) => {
  const clean = phone.replace(/\D/g, "");
  return clean + "@s.whatsapp.net";
};
