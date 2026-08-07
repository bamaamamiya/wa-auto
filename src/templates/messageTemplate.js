import { getOngkirNormal } from "../utils/ongkir.js";

export const buildOrderMessage = (data) => {
  const price = Number(data.price) || 0;
  const ongkir = Number(data.ongkir) || 0;

  const ongkirNormal = getOngkirNormal(ongkir);
  const total = price + ongkir;

  const formatHargaSingkat = (value) => {
    if (!value) return "-";
    if (value >= 1000000)
      return (value / 1000000).toFixed(1).replace(".0", "") + "jt";
    return Math.round(value / 1000) + "rb";
  };

  const pesan = `
Terima kasih sudah melakukan pemesanan 🙏
Berikut detail pesanan Kakak:

Nama Produk: ${data.productTitle || "-"}
Harga Produk: ${formatHargaSingkat(price)}
Ongkir: ~${formatHargaSingkat(ongkirNormal)}~ ${formatHargaSingkat(ongkir)}
Total Pembayaran: ${formatHargaSingkat(total)}

Nama: ${data.name || "-"}
Alamat Lengkap: ${data.addressClean || "-"}

Pesanan akan segera diproses sesuai data yang telah dikirim saat checkout.

Terima kasih sudah pesan di toko kami 🙏
`;

  return pesan.trim();
};
