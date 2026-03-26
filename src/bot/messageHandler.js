// src/bot/messageHandler.js
import { db } from "../firebase/firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { sendMessage } from "../utils/helpers.js";
import { buildUpsellConfirmationMessage } from "../templates/messageUpsellConfirmation.js";
import { buildUpsellMessage } from "../templates/upsellTemplate.js";

export const handleIncomingMessage = async (msg, bot) => {
  try {
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const jid =
      msg.key.participant || msg.key.remoteJidAlt || msg.key.remoteJid;
    const text =
      msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    if (!text) return;

    const phone = jid.replace("@s.whatsapp.net", "").replace("@lid", "");
    console.log("📩 Incoming:", phone, text);

    // Get lead
    const q = query(collection(db, "leads"), where("whatsapp", "==", phone));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return console.log("❌ Lead tidak ditemukan:", phone);

    const docSnap = snapshot.docs[0];
    const lead = docSnap.data();
    const leadId = docSnap.id;

    const lowerText = text.toLowerCase();

    // ✅ CONFIRMATION DETECT
    const isConfirm =
      lowerText.includes("ok") ||
      lowerText.includes("iya") ||
      lowerText.includes("benar");

    // STEP 1 → CONFIRMATION
    if (lead.state === "WAITING_CONFIRMATION" && isConfirm) {
      console.log("✅ CONFIRMED:", phone);

      await updateDoc(doc(db, "leads", leadId), {
        confirmation: "sudah",
        state: "WAITING_UPSELL",
      });

      // Kirim pesan upsell
      if (lead.upsells?.length > 0) {
        const upsellMsg = buildUpsellMessage(lead);
        await sendMessage(bot, jid, upsellMsg);
      }

      return;
    }

    // STEP 2 → UPSELL SELECT
    if (lead.state === "WAITING_UPSELL") {
      const input = text.trim().toLowerCase();
      const selected = lead.upsells.find(
        (u) =>
          input.includes(u.code.toLowerCase()) ||
          input.includes(u.title.toLowerCase()),
      );

      if (selected) {
        console.log("🔥 UPSOLD:", selected.title);

        const newTotal = lead.price + selected.price + (lead.ongkir || 0);

        // Update Firestore dengan snapshot upsell
        await updateDoc(doc(db, "leads", leadId), {
          productTitle: `${lead.productTitle} + ${selected.title}`,
          price: lead.price + selected.price,
          costProduct: lead.costProduct + selected.cost,
          upsellId: selected.id,               // simpan id
          selectedUpsell: { ...selected },     // simpan snapshot lengkap
          total: newTotal,
          state: "DONE",
        });

        // Kirim konfirmasi rincian
        const confirmationMsg = buildUpsellConfirmationMessage({
          ...lead,
          upsellId: selected,
        });
        await sendMessage(bot, jid, confirmationMsg);

        return;
      }

      // Optional: jika input user ga match upsell
      await sendMessage(
        bot,
        jid,
        "Maaf kak, pilihannya belum valid. Mohon pilih sesuai list di atas 🙏",
      );
    }
  } catch (err) {
    console.error("❌ Error handleIncomingMessage:", err);
  }
};
