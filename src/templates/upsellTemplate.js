export const buildUpsellMessage = (data) => {
  let text = `Oh iya kak, CCTV ini bisa dipantau real-time lewat HP, suara 2 arah & deteksi pergerakan.\n\n`;

  if (data.upsells.length > 0) {
    text += "Kalau mau tambahan, customer biasanya pilih:\n";

    data.upsells.forEach((u) => {
      text += `📌 ${u.title} = ${u.price / 1000}rb`;
      if (u.script) text += `\n   👉 ${u.script}`;
      text += "\n";
    });

    text += `\nKakak mau pilih yang mana? 🙏`;
  } else {
    text += "Saat ini tidak ada opsi tambahan untuk produk ini.\n";
  }

  return text;
};