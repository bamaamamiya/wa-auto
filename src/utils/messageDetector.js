export const isConfirmation = (text) => {
  if (!text) return false;

  const normalized = text.toLowerCase().trim();

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

  return confirmKeywords.some((word) => normalized.includes(word));
};