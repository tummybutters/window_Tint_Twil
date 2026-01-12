export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return "unknown";
  return phone.replace(/(\+\d{1,3})(\d{0,3})(\d+)(\d{2})$/, (_match, cc, area, middle, end) => {
    const hiddenArea = area ? "***" : "";
    const hiddenMiddle = middle.replace(/\d/g, "*");
    return `${cc}${hiddenArea}${hiddenMiddle}${end}`;
  });
}

export function summarizeMessageBody(body?: string | null, max = 80): string {
  if (!body) return "";
  const cleaned = body.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}...` : cleaned;
}

export function isLikelyPhoneNumber(value?: string | null): boolean {
  if (!value) return false;
  return /^\+?\d{7,15}$/.test(value);
}
