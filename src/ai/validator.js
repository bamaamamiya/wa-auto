const FORBIDDEN_PATTERNS = [
  /database/i,
  /dokumen/i,
  /retrieval/i,
  /\bsistem\b/i,
  /artificial intelligence/i,
  /product id/i,
  /informasi yang saya miliki/i,
  /Rp\s[\d.]+\.000/, // blokir "Rp 99.000" tapi bukan "Rp 149rb"
];

const MAX_CHARS = 500;
const MIN_CHARS = 5;

export const validateReply = (text) => {
  const errors = [];

  if (!text || text.trim().length === 0) {
    errors.push("empty");
  }

  if (text.length < MIN_CHARS) {
    errors.push("too_short");
  }

  if (text.length > MAX_CHARS) {
    errors.push("too_long");
  }

  const foundForbidden = FORBIDDEN_PATTERNS.filter((pattern) =>
    pattern.test(text),
  );

  if (foundForbidden.length > 0) {
    errors.push(`forbidden_words: ${foundForbidden.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
