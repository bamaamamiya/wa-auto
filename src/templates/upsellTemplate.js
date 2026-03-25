export const buildUpsellMessage = (data) => {
  // Pesan pembuka
  let text = `Oh iya kak, CCTV ini bisa dipantau real-time lewat HP, suara 2 arah & deteksi pergerakan.\n`;

  // Kalau ada upsell (memory card)
  if (data.upsells.length > 0) {
    text += "Kalau mau rekam otomatis, biasanya customer tambahkan memori juga:\n";

    data.upsells.forEach((u) => {
      // Format harga pakai ribuan (rb)
      const hargaSingkat = u.price >= 1000 ? `${u.price / 1000}rb` : u.price;
      text += `📌 ${u.title} = ${hargaSingkat}`;
      if (u.script) text += ` → ${u.script}`;
      text += "\n";
    });

    text += `Kakak mau sekalian pakai yang ${data.upsells[0].title} atau langsung ${data.upsells[data.upsells.length - 1].title} biar lebih awet? 🙏`;
  } else {
    text += "Saat ini tidak ada opsi tambahan untuk produk ini.\n";
  }

  return text;
};