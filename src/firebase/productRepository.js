import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

import { db } from "./firebase.js";

const configuredCollection = process.env.PRODUCT_COLLECTION || "products";
const productCollections = [
  configuredCollection,
  "products",
  "product",
].filter((value, index, list) => value && list.indexOf(value) === index);

const getProductIdsFromLead = (lead) => {
  return [
    lead.product_id,
    lead.productId,
    lead.productID,
    lead.product?.product_id,
    lead.product?.productId,
  ].filter(Boolean);
};

const getProductTitlesFromLead = (lead) => {
  if (!lead.productTitle) return [];

  const title = lead.productTitle.trim();
  const baseTitle = title.split("+")[0]?.trim();

  return [title, baseTitle].filter(
    (value, index, list) => value && list.indexOf(value) === index,
  );
};

const findByDocId = async (collectionName, productId) => {
  const snapshot = await getDoc(doc(db, collectionName, productId));
  return snapshot.exists() ? snapshot : null;
};

const findByField = async (collectionName, field, value) => {
  const q = query(
    collection(db, collectionName),
    where(field, "==", value),
    limit(1),
  );

  const snapshot = await getDocs(q);
  return snapshot.empty ? null : snapshot.docs[0];
};

export const findProductForLead = async (lead) => {
  const productIds = getProductIdsFromLead(lead);

  for (const collectionName of productCollections) {
    for (const productId of productIds) {
      const byDocId = await findByDocId(collectionName, productId);
      if (byDocId) return byDocId;

      const byProductId = await findByField(collectionName, "product_id", productId);
      if (byProductId) return byProductId;
    }
  }

  const productTitles = getProductTitlesFromLead(lead);

  for (const collectionName of productCollections) {
    for (const productTitle of productTitles) {
      const byIdentityName = await findByField(
        collectionName,
        "identity.name",
        productTitle,
      );

      if (byIdentityName) return byIdentityName;
    }
  }

  return null;
};
