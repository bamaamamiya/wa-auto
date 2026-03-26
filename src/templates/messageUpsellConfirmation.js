export const buildUpsellConfirmationMessage = (lead) => {
  const formatHargaSingkat = (value) => {
    if (!value) return "-";
    if (value >= 1000000)
      return (value / 1000000).toFixed(1).replace(".0", "") + "jt";
    return Math.round(value / 1000) + "rb";
  };

	// Gunakan price awal
	const productPrice = lead.productPrice || lead.price - (lead.selectedUpsell?.price || 0)
	const upsellPrice = lead.selectedUpsell?.price || 0
	const ongkir = lead.ongkir || 0
  const total = productPrice + upsellPrice + ongkir

  const lines = [];
  lines.push("Baik kak, kami update ya 🙏");

  // Produk utama
  lines.push(`📌 ${lead.productTitle.replace(/ \+ .+$/, "")} : ${formatHargaSingkat(productPrice)}`);

  // Upsell (jika ada)
  if (lead.selectedUpsell) {
    lines.push(`📌 ${lead.selectedUpsell.title} : ${formatHargaSingkat(upsellPrice)}`);
  }

  // Ongkir
  lines.push(`📌 Ongkir : ${formatHargaSingkat(ongkir)}`);

  // Total
  lines.push(`Total : ${formatHargaSingkat(total)}\n`);

  lines.push("Ini rincian terbarunya 🙏");

  return lines.join("\n");
};