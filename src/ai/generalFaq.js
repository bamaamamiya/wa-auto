// generalFaq.js

export const GENERAL_FAQ = [
  {
    name: "shipping_estimation",
    priority: 1,

    keywords: [
      "estimasi",
      "kapan sampai",
      "berapa hari",
      "lama sampai",
      "estimasi pengiriman",
    ],

    handler: ({ lead, getShippingRegion }) => {
      const region = getShippingRegion(lead);

      const ESTIMATION = {
        jawa: "2–4 hari kerja",
        luar_jawa: "4–8 hari kerja",
      };

      return `Estimasi pengiriman sekitar ${
        ESTIMATION[region] || "belum tersedia"
      }, dihitung setelah pesanan diproses ya kak 🙏`;
    },
  },

  {
    name: "warranty",
    keywords: [
      "garansi",
      "original",
      "ori",
      "asli",
      "jaminan",
      "aman",
      "retur",
    ],

    handler: () =>
      [
        "Produk yang dikirim merupakan produk original sesuai deskripsi.",
        "Semua barang melalui pengecekan sebelum dikirim.",
        "Jika ada kendala saat barang diterima, mohon simpan video unboxing untuk membantu proses pengecekan klaim ya kak 🙏",
      ].join(" "),
  },
];
