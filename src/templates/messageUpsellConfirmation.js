export const buildUpsellConfirmationMessage = (lead) => {
  const formatHargaSingkat = (value) => {
    if (!value) return "-";
    if (value >= 1_000_000)
      return (value / 1_000_000).toFixed(1).replace(".0", "") + "jt";
    return Math.round(value / 1000) + "rb";
  };

  const mainProductPrice =
    lead.price - (lead.selectedUpsell?.price || 0);

  const upsell = lead.selectedUpsell;
  const ongkir = lead.ongkir || 0;
  const total =
    mainProductPrice + (upsell?.price || 0) + ongkir;

  // ✅ ambil hanya produk utama
  const mainProductTitle =
    lead.productTitle?.split(" + ")[0] || "Produk";

  // ✅ format upsell jadi "Memori 32GB"
  const upsellTitle = upsell
    ? `Memori ${upsell.code?.toUpperCase()}`
    : null;

  let text = `Baik kak, kami update ya 🙏\n`;

  text += `📌 ${mainProductTitle} : ${formatHargaSingkat(mainProductPrice)}\n`;

  if (upsell) {
    text += `📌 ${upsellTitle} : ${formatHargaSingkat(upsell.price)}\n`;
  }

  text += `📌 Ongkir : ${formatHargaSingkat(ongkir)}\n`;

  text += `Total : ${formatHargaSingkat(total)}\n\n`;

  text += `ini rincian terbarunya🙏`;

  return text;
};