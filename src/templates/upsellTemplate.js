export const buildUpsellMessage = (data) => {
  let text = `Oh iya kak, CCTV ini bisa dipantau real-time lewat HP, suara 2 arah & deteksi pergerakan.\n`;

  if (data.upsells.length > 0) {
    // ambil upsell berdasarkan code
    const upsell16 = data.upsells.find((u) => u.code === "16gb");
    const upsell32 = data.upsells.find((u) => u.code === "32gb");

    // helper format
    const formatHarga = (price) => `${price / 1000}rb`;
    const formatLabel = (code) => code.toUpperCase();

    text += `Kalau mau rekam otomatis, biasanya customer tambahkan memori juga:\n`;

    if (upsell16) {
      text += `📌 ${formatLabel(upsell16.code)} = ${formatHarga(upsell16.price)} → simpan rekaman ±1 minggu\n`;
    }

    if (upsell32) {
      text += `📌 ${formatLabel(upsell32.code)} = ${formatHarga(upsell32.price)} → simpan rekaman ±3 minggu (ini paling sering dipilih kak 🙏)\n`;
    }

    text += `Kakak mau sekalian pakai yang ${formatLabel(upsell16?.code)} atau langsung ${formatLabel(upsell32?.code)} biar lebih awet?`;
  }

  return text;
};