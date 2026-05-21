const normalizeText = (text) => {
  if (!text) return false;

  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const isAddressConfirmation = (text) => {
  const normalized = normalizeText(text);

  if (!normalized) return false;

  const normalizedWithoutCourtesy = normalized
    .replace(/\b(kak|ka|gan|sis)\b$/u, "")
    .trim();

  const addressPhrases = [
    "alamat sudah benar",
    "alamatnya sudah benar",
    "alamat sudah bener",
    "alamatnya sudah bener",
    "alamat benar",
    "alamatnya benar",
    "alamat bener",
    "alamatnya bener",
    "alamat sudah sesuai",
    "alamatnya sudah sesuai",
    "data sudah benar",
    "datanya sudah benar",
    "data sudah bener",
    "datanya sudah bener",
    "sudah sesuai",
  ];

  const shortAddressConfirmations = [
    "sudah",
    "sudah benar",
    "sudah bener",
    "benar",
    "bener",
    "betul",
    "sudah betul",
    "sesuai",
  ];

  return (
    addressPhrases.some((phrase) => normalized.includes(phrase)) ||
    shortAddressConfirmations.includes(normalized) ||
    shortAddressConfirmations.includes(normalizedWithoutCourtesy)
  );
};

export const isConfirmation = (text) => {
  const normalized = normalizeText(text);

  if (!normalized) return false;

  const rejectKeywords = [
    "tidak",
    "nggak",
    "enggak",
    "gak",
    "ga",
    "belum",
    "jangan",
    "batal",
    "cancel",
  ];

  if (
    rejectKeywords.some((word) =>
      new RegExp(`\\b${word}\\b`, "u").test(normalized),
    )
  ) {
    return false;
  }

  const confirmKeywords = [
    "ok",
    "oke",
    "okey",
    "iya",
    "iya kak",
    "ya",
    "y",
    "betul",
    "benar",
    "sip",
    "gas",
    "lanjut",
    "jadi",
  ];

  return confirmKeywords.some((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "u").test(normalized);
  });
};
