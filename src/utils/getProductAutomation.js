import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase.js";

export const getProductAutomation = async (productId) => {
  if (!productId) {
    return null;
  }

  const productRef = doc(db, "products", productId);
  const productSnap = await getDoc(productRef);

  if (!productSnap.exists()) {
    console.log("❌ Product tidak ditemukan:", productId);
    return null;
  }

  const product = productSnap.data();

  const automation = {
    aiAgent: product.settings?.automation?.aiAgent ?? false,
    faq: product.settings?.automation?.faq ?? false,
    reminder: product.settings?.automation?.reminder ?? false,
    followUp: product.settings?.automation?.followUp ?? false,
    upsell: product.settings?.automation?.upsell ?? false,
  };

  return {
    product,
    automation,
  };
};