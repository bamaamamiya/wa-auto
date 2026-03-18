// utils/ongkir.js

// Fungsi untuk menentukan ongkir normal (sebelum diskon)
export const getOngkirNormal = (ongkirValue) => {
  if (ongkirValue <= 20000) return 25000;
  if (ongkirValue <= 30000) return 35000;
  if (ongkirValue <= 35000) return 40000;
  return ongkirValue; // fallback jika diluar range
};
