export const buildUpsellConfirmationMessage = (lead) => {
  const formatHargaSingkat = (value) => {
    if (!value) return "-";
    if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(".0", "") + "jt";
    return Math.round(value / 1000) + "rb";
  };

  // Produk utama (harga sebelum upsell)
  const mainProductPrice = lead.price - (lead.selectedUpsell?.price || 0);

  const upsells = lead.selectedUpsell ? [lead.selectedUpsell] : [];
  const ongkir = lead.ongkir || 0;
  const total = mainProductPrice + upsells.reduce((acc, u) => acc + (u.price || 0), 0) + ongkir;

  const lines = [];
  lines.push("Baik kak, kami update ya 🙏\n");

  // Produk utama
  const mainProductTitle = lead.productTitle?.split(" + ")[0] || lead.productTitle || "Produk";
  lines.push(`📌 ${mainProductTitle} : ${formatHargaSingkat(mainProductPrice)}`);

  // Upsell
  upsells.forEach((u) => {
    lines.push(`📌 ${u.title} : ${formatHargaSingkat(u.price)}`);
  });

  // Ongkir
  lines.push(`📌 Ongkir : ${formatHargaSingkat(ongkir)}\n`);

  // Total
  lines.push(`Total : ${formatHargaSingkat(total)}\n`);
  lines.push("Ini rincian terbarunya 🙏");

  return lines.join("\n");
};