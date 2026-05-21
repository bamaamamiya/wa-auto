export const STOP_WORDS = new Set([
  "aku",
  "apa",
  "apakah",
  "atau",
  "bisa",
  "dan",
  "di",
  "ini",
  "itu",
  "jadi",
  "kak",
  "kalau",
  "ke",
  "nya",
  "produk",
  "saya",
  "yang",
]);

export const OUT_OF_SCOPE_REPLY =
  "Maaf kak, kita hanya bisa jawab seputar pesanan kakak saja.";

export const GREETING_REPLY = "Halo kak, ada yang bisa dibantu seputar pesanan kakak?";

export const GENERAL_FACTS = {
  discount: {
    additional_discount: false,
    answer: "Tidak ada diskon atau potongan tambahan.",
  },
  warranty_claim: {
    required_evidence:
      "Jika paket sudah sampai, simpan foto resi dan video unboxing untuk membantu laporan klaim garansi.",
  },
  fallback:
    "Maaf kak, detail itu belum tersedia di data pesanan kakak.",
};

export const ORDER_KEYWORDS = [
  "alamat",
  "bayar",
  "cod",
  "diskon",
  "garansi",
  "harga",
  "estimasi",
  "kirim",
  "kurir",
  "lama",
  "ongkir",
  "order",
  "paket",
  "payment",
  "pembayaran",
  "pengiriman",
  "pesanan",
  "potongan",
  "produk",
  "sampai",
  "total",
  "transfer",
];

export const INTENT_GROUPS = [
  {
    name: "shipping",
    keywords: [
      "estimasi",
      "kapan sampai",
      "berapa lama",
      "lama sampai",
      "pengiriman",
      "dikirim",
      "kirim",
      "sampai",
      "kurir",
    ],
    paths: [
      "shipping.selected_region",
      "shipping.selected_estimation",
      "shipping",
      "order.province",
      "order.addressClean",
      "order.ongkir",
      "order.state",
    ],
  },
  {
    name: "pricing",
    keywords: [
      "harga",
      "berapa",
      "total",
      "ongkir",
      "bayar",
      "biaya",
      "cod",
      "diskon",
      "potongan",
    ],
    paths: [
      "pricing",
      "general.discount",
      "order.price",
      "order.ongkir",
      "order.productTitle",
    ],
  },
  {
    name: "warranty",
    keywords: ["garansi", "warranty", "retur", "refund", "rusak", "tukar"],
    paths: [
      "pricing.warranty_days",
      "warranty",
      "policy",
      "constraints",
      "general.warranty_claim",
    ],
  },
  {
    name: "payment",
    keywords: [
      "payment",
      "pembayaran",
      "metode bayar",
      "metode pembayaran",
      "bayar pakai",
      "transfer",
      "cod",
    ],
    paths: ["order.paymentMethod", "pricing.cod", "general.discount"],
  },
  {
    name: "usage",
    keywords: [
      "cara",
      "pakai",
      "pasang",
      "install",
      "setting",
      "seting",
      "gunakan",
      "reset",
    ],
    paths: ["usage", "specification.app", "constraints"],
  },
  {
    name: "package",
    keywords: ["isi", "paket", "dapat apa", "kelengkapan", "box"],
    paths: ["specification.package_content", "package_content", "identity"],
  },
  {
    name: "feature",
    keywords: [
      "fitur",
      "fungsi",
      "bisa",
      "support",
      "mendukung",
      "spesifikasi",
      "spek",
    ],
    paths: ["features", "specification", "constraints"],
  },
];
