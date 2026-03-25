export const buildUpsellConfirmationMessage = (lead) => {
  const formatHargaSingkat = (value) => {
    if (!value) return "-";
    if (value >= 1000000)
      return (value / 1000000).toFixed(1).replace(".0", "") + "jt";
    return Math.round(value / 1000) + "rb";
  };

  const total = lead.price + (lead.selectedUpsell?.price || 0) + lead.ongkir;

  const lines = [];
  lines.push("Baik kak, kami update ya 🙏");

  // Produk utama
  lines.push(`📌 ${lead.productTitle} : ${formatHargaSingkat(lead.price)}`);

  // Upsell (jika ada)
  if (lead.selectedUpsell) {
    lines.push(`📌 ${lead.selectedUpsell.title} : ${formatHargaSingkat(lead.selectedUpsell.price)}`);
  }

  // Ongkir
  lines.push(`📌 Ongkir : ${formatHargaSingkat(lead.ongkir)}`);

  // Total
  lines.push(`Total : ${formatHargaSingkat(total)}\n`);

  lines.push("Ini rincian terbarunya 🙏");

  return lines.join("\n");
};